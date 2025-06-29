import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
// Hapus baris ini karena menyebabkan kesalahan kompilasi di beberapa lingkungan Next.js:
// import 'react-toastify/dist/ReactToastify.css'; 
import { io } from 'socket.io-client';

export default function FingerprintSystem() {
  const [status, setStatus] = useState('unknown');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false); // State baru untuk identifikasi 1:N
  const [template1Created, setTemplate1Created] = useState(false);
  const [template2Created, setTemplate2Created] = useState(false);
  const [matchResult, setMatchResult] = useState(null); // Hasil pencocokan 1:1
  const [identificationResult, setIdentificationResult] = useState(null); // Hasil identifikasi 1:N
  const [previewImage, setPreviewImage] = useState(null);
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [enrollmentMessage, setEnrollmentMessage] = useState('');
  const [identificationMessage, setIdentificationMessage] = useState(''); // Pesan baru untuk identifikasi

  const socketRef = useRef(null);
  const stateRef = useRef(); // Ref untuk menyimpan state terbaru

  // Gabungkan semua status loading
  const isLoading = isCapturing || isEnrolling || isIdentifying;

  // Selalu update ref dengan nilai state terbaru pada setiap render
  stateRef.current = { isEnrolling, name, idNumber, isLoading, isIdentifying };

  const API_URL = 'http://localhost:3000/api';
  const SOCKET_URL = 'http://localhost:3000';

  // Fungsi untuk menangani error enrollment secara konsisten
  const handleEnrollmentError = (message = 'Proses enrollment gagal.') => {
    console.error("FRONTEND: Enrollment process failed. Message:", message);
    toast.error(message);
    setIsEnrolling(false);
    setEnrollmentMessage('');
    setPreviewImage(null);
  };

  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        console.log("FRONTEND: [useEffect] Checking initial device status...");
        const response = await axios.get(`${API_URL}/device-status`);
        setStatus(response.data.status);
        setTemplate1Created(response.data.templates.template1);
        setTemplate2Created(response.data.templates.template2);
        console.log("FRONTEND: [useEffect] Initial status checked:", response.data);
      } catch (error) {
        toast.error('Gagal memeriksa status perangkat. Apakah backend berjalan?');
        setStatus('error');
      }
    };
    checkInitialStatus();

    // --- PERBAIKAN: Koneksi WebSocket dibuat sekali dan tidak bergantung pada state ---
    if (!socketRef.current) {
      console.log("FRONTEND: [useEffect] Setting up WebSocket connection for the first time...");
      socketRef.current = io(SOCKET_URL, {
        reconnectionAttempts: 5,
        transports: ['websocket']
      });

      const socket = socketRef.current;
      socket.on('connect', () => {
        console.log("FRONTEND: [Socket.IO] Connected successfully.");
        toast.info("Terhubung ke layanan WebSocket.");
      });
      socket.on('disconnect', () => {
        console.log("FRONTEND: [Socket.IO] Disconnected.");
        toast.warn("Terputus dari layanan WebSocket.");
      });
      socket.on('connect_error', (err) => {
        console.error("FRONTEND: [Socket.IO] Connection error:", err);
        toast.error("Tidak dapat terhubung ke WebSocket.");
      });

      socket.on('live_preview', (data) => {
        // Gunakan state dari ref untuk memastikan nilai selalu yang terbaru
        if (stateRef.current.isLoading) {
          setPreviewImage(data.image_data);
        }
      });

      socket.on('enrollment_step', (data) => {
        const { isEnrolling: isEnrollingNow } = stateRef.current;
        console.log("FRONTEND: [Socket.IO] Received 'enrollment_step' event:", data);
        if (isEnrollingNow) {
          setEnrollmentMessage(data.message);
          setIdentificationMessage(''); // Clear identification message if enrollment starts

          if (data.step === "finished") {
            console.log("FRONTEND: [enrollment_step] Enrollment sequence finished, now saving data to DB...");
            toast.info("Menyimpan data ke database...");
            axios.post(`${API_URL}/save_enrollment`, { name: stateRef.current.name, idNumber: stateRef.current.idNumber })
              .then(response => {
                toast.success(response.data.message);
                setIsEnrolling(false);
                setEnrollmentMessage('');
                setPreviewImage(null);
                setName(''); // Clear form after successful enrollment
                setIdNumber(''); // Clear form after successful enrollment
              })
              .catch(err => {
                handleEnrollmentError(err.response?.data?.message || "Gagal menyimpan data ke database.");
              });
          }
        }
      });

      socket.on('capture_result', (data) => {
        const { isEnrolling: isEnrollingNow } = stateRef.current;
        console.log("FRONTEND: [Socket.IO] Received 'capture_result' event:", data);

        if (isEnrollingNow) {
          if (!data.success) {
            handleEnrollmentError(data.message);
          }
          // Jika sukses, tidak perlu melakukan apa-apa di sini.
          // Alur akan dilanjutkan oleh event 'enrollment_step' yang dikirim dari agen.
        } else {
          // Logika untuk pengambilan template manual
          console.log("FRONTEND: [capture_result] Handling manual capture result.");
          setIsCapturing(false);
          setPreviewImage(null);
          setEnrollmentMessage(''); // Clear messages related to enrollment
          setIdentificationMessage(''); // Clear messages related to identification
          if (data.success) {
            toast.success(data.message);
            if (data.template_no === 1) setTemplate1Created(true);
            if (data.template_no === 2) setTemplate2Created(true);
          } else {
            toast.error(data.message || 'Pengambilan gagal.');
          }
        }
      });

      // --- Listener baru untuk identifikasi 1:N ---
      socket.on('identification_step', (data) => {
        const { isIdentifying: isIdentifyingNow } = stateRef.current;
        console.log("FRONTEND: [Socket.IO] Received 'identification_step' event:", data);
        if (isIdentifyingNow) {
          setIdentificationMessage(data.message);
          setEnrollmentMessage(''); // Clear enrollment message if identification starts
        }
      });

      socket.on('identification_result', (data) => {
        console.log("FRONTEND: [Socket.IO] Received 'identification_result' event:", data);
        const { isIdentifying: isIdentifyingNow } = stateRef.current;
        if (isIdentifyingNow) {
          setIsIdentifying(false);
          setPreviewImage(null);
          setIdentificationMessage(''); // Clear identification message
          setEnrollmentMessage(''); // Clear enrollment message
          setIdentificationResult(data); // Set the identification result

          if (data.success) {
            if (data.found) {
              toast.success(`Identifikasi berhasil! Ditemukan: ${data.name} (Skor: ${data.score})`);
            } else {
              toast.info(data.message); // "Sidik jari tidak ditemukan"
            }
          } else {
            toast.error(data.message || "Identifikasi gagal.");
          }
        }
      });
      // --- Akhir listener baru ---
    }

    return () => {
      if (socketRef.current) {
        console.log("FRONTEND: [useEffect cleanup] Disconnecting WebSocket.");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Dependency array kosong agar efek hanya berjalan sekali saat komponen dimuat

  const initializeDevice = async () => {
    setIsCapturing(true);
    try {
      console.log("FRONTEND: [API Call] Initializing device...");
      const response = await axios.post(`${API_URL}/init-device`);
      toast.success(response.data.message);
      setStatus('ready');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Inisialisasi gagal');
      setStatus('error');
    } finally {
      setIsCapturing(false);
    }
  };

  const createTemplate = async (templateNo, captureType) => {
    setIsCapturing(true);
    setMatchResult(null); // Clear previous match result
    setIdentificationResult(null); // Clear previous identification result
    setPreviewImage(null);
    setEnrollmentMessage('');
    setIdentificationMessage('');

    try {
      console.log(`FRONTEND: [API Call] Requesting manual template creation. No: ${templateNo}, Type: ${captureType}`);
      const response = await axios.post(`${API_URL}/create_template`, {
        template_no: templateNo,
        capture_type: captureType
      });
      if (!response.data.success) {
        toast.error(response.data.message);
        setIsCapturing(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memulai proses pengambilan');
      setIsCapturing(false);
    }
  };

  const matchTemplates = async () => {
    setIsCapturing(true);
    setIdentificationResult(null); // Clear previous identification result
    setEnrollmentMessage('');
    setIdentificationMessage('');
    try {
      console.log("FRONTEND: [API Call] Requesting template match.");
      const response = await axios.post(`${API_URL}/match_templates`);
      setMatchResult(response.data);
      if (response.data.success) {
        if (response.data.matched) {
          toast.success(`Sidik jari cocok! Skor: ${response.data.score}`);
        } else {
          toast.warn(`Sidik jari tidak cocok. Skor: ${response.data.score}`);
        }
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Pencocokan gagal');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleStartEnrollment = () => {
    if (!name || !idNumber) {
      toast.warn("Harap isi Nama dan Nomor ID terlebih dahulu.");
      return;
    }
    if (isLoading) {
      toast.info("Proses lain sedang berjalan.");
      return;
    }

    console.log("FRONTEND: Starting automatic enrollment process...");
    setIsEnrolling(true);
    setMatchResult(null); // Clear 1:1 match result
    setIdentificationResult(null); // Clear 1:N identification result
    setPreviewImage(null);
    setTemplate1Created(false);
    setTemplate2Created(false);
    setEnrollmentMessage(''); // Clear any previous messages
    setIdentificationMessage(''); // Clear identification messages

    axios.post(`${API_URL}/start_enrollment`)
      .catch(err => {
        handleEnrollmentError(err.response?.data?.message || "Gagal memulai enrollment.");
      });
  };

  // --- Fungsi baru untuk memulai identifikasi 1:N ---
  const handleStartIdentification = async () => {
    if (isLoading) {
      toast.info("Proses lain sedang berjalan.");
      return;
    }
    if (status !== 'ready') {
      toast.warn("Perangkat belum diinisialisasi.");
      return;
    }

    console.log("FRONTEND: Starting 1:N identification process...");
    setIsIdentifying(true);
    setMatchResult(null); // Clear 1:1 match result
    setIdentificationResult(null); // Clear previous 1:N match result
    setPreviewImage(null); // Clear preview image
    setEnrollmentMessage(''); // Clear any previous enrollment messages
    setIdentificationMessage(''); // Clear any previous identification message

    try {
      const response = await axios.post(`${API_URL}/identify`);
      if (!response.data.success) {
        toast.error(response.data.message);
        setIsIdentifying(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memulai proses identifikasi.');
      setIsIdentifying(false);
    }
  };
  // --- Akhir fungsi baru ---


  const renderTemplateSection = (templateNo) => {
    const isCreated = templateNo === 1 ? template1Created : template2Created;
    return (
      <div className="template-card">
        <h4>{`Template Manual ${templateNo}`} {isCreated && <span className="status-chip success">Tersimpan</span>}</h4>
        <p>Gunakan ini untuk verifikasi 1:1.</p>
        <div className="button-group">
          <button onClick={() => createTemplate(templateNo, 'left_four')} disabled={isLoading || status !== 'ready'} className="btn btn-secondary">
            4 Jari Kiri
          </button>
          <button onClick={() => createTemplate(templateNo, 'right_four')} disabled={isLoading || status !== 'ready'} className="btn btn-secondary">
            4 Jari Kanan
          </button>
          <button onClick={() => createTemplate(templateNo, 'two_thumbs')} disabled={isLoading || status !== 'ready'} className="btn btn-secondary">
            2 Jempol
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-background">
      <div className="container">
        <header className="header">
          <h1>Sistem Pengenalan Sidik Jari</h1>
          <div className={`status ${status}`}>
            Status: <span>{status.toUpperCase()}</span>
          </div>
        </header>

        <main className="main-content">
          <section className="control-section">
            <h2>1. Kontrol Perangkat</h2>
            <div className="button-group">
              <button onClick={initializeDevice} disabled={isLoading || status === 'ready'} className="btn btn-primary">
                {isLoading ? 'Memproses...' : 'Inisialisasi Perangkat'}
              </button>
            </div>
          </section>

          <section className="capture-section">
            <h2>2. Enrollment & Verifikasi</h2>
            <div className="capture-layout">
              <div className="template-controls">
                <div className="enrollment-card">
                  <h3>Enrollment Otomatis (4-4-2)</h3>
                  <div className="input-group">
                    <label htmlFor="name">Nama</label>
                    <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} placeholder="Masukkan nama lengkap" className="form-input" />
                  </div>
                  <div className="input-group">
                    <label htmlFor="idNumber">Nomor ID</label>
                    <input type="text" id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} disabled={isLoading} placeholder="Masukkan nomor identitas" className="form-input" />
                  </div>
                  <button onClick={handleStartEnrollment} disabled={isLoading || status !== 'ready'} className="btn btn-enroll">
                    {isEnrolling ? 'Sedang Mendaftarkan...' : 'Mulai Enrollment Otomatis'}
                  </button>
                  <p className="enroll-note">Proses ini akan menyimpan data ke database.</p>
                </div>

                <div className="verification-card">
                  <h3>Verifikasi Manual (1:1)</h3>
                  {renderTemplateSection(1)}
                  {renderTemplateSection(2)}
                  <button onClick={matchTemplates} disabled={isLoading || !template1Created || !template2Created || status !== 'ready'} className="btn btn-warning">
                    Cocokkan Template 1 vs 2
                  </button>
                </div>
              </div>
              <div className="preview-container">
                <h3>Pratinjau Langsung</h3>
                <div className="preview-box">
                  {previewImage ? (
                    <img src={previewImage} alt="Pratinjau Sidik Jari" />
                  ) : (
                    <div className="placeholder">
                      {isEnrolling
                        ? enrollmentMessage
                        : isIdentifying
                          ? (identificationMessage || 'Letakkan jari apapun pada pemindai...')
                          : (isCapturing ? 'Letakkan jari pada pemindai...' : 'Pratinjau akan muncul di sini.')}
                    </div>
                  )}
                </div>
                {matchResult && (
                  <div className={`match-result ${matchResult.success && matchResult.matched ? 'success' : 'fail'}`}>
                    <h4>Hasil Pencocokan (1:1):</h4>
                    {matchResult.success ? (
                      <>
                        <p>Skor: {matchResult.score}</p>
                        <p>Status: {matchResult.matched ? 'COCOK' : 'TIDAK COCOK'}</p>
                      </>
                    ) : (
                      <p>Error: {matchResult.message}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* --- Bagian baru untuk Identifikasi 1:N --- */}
          <section className="identification-section">
            <h2>3. Identifikasi (1:N)</h2>
            <p className="identify-note">Temukan identitas pengguna dari database dengan satu sidik jari.</p>
            <button onClick={handleStartIdentification} disabled={isLoading || status !== 'ready'} className="btn btn-identify">
              {isIdentifying ? 'Sedang Mengidentifikasi...' : 'Mulai Identifikasi'}
            </button>

            {identificationResult && (
              <div className={`id-result ${identificationResult.found ? 'success' : 'fail'}`}>
                <h4>Hasil Identifikasi (1:N):</h4>
                {identificationResult.success ? (
                  <>
                    {identificationResult.found ? (
                      <>
                        <p>Ditemukan: {identificationResult.name}</p>
                        <p>Nomor ID: {identificationResult.id_number}</p>
                        <p>Skor Kecocokan: {identificationResult.score}</p>
                      </>
                    ) : (
                      <p>{identificationResult.message}</p>
                    )}
                  </>
                ) : (
                  <p>Error: {identificationResult.message}</p>
                )}
              </div>
            )}
          </section>
          {/* --- Akhir bagian baru --- */}
        </main>

        <ToastContainer position="bottom-right" autoClose={4000} hideProgressBar={false} />
      </div>
      <style jsx>{`
        .app-background { background-color: #f0f2f5; min-height: 100vh; padding: 2rem; display: flex; align-items: flex-start; justify-content: center; }
        .container { width: 100%; max-width: 960px; padding: 2rem; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
        .header { text-align: center; margin-bottom: 2rem; }
        h1 { color: #1f2937; }
        h2, h3 { margin-top: 0; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
        h4 { color: #1f2937; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
        .status { padding: 0.5rem 1rem; border-radius: 8px; display: inline-block; margin-top: 1rem; font-weight: 500; }
        .status.ready { background-color: #d1fae5; color: #065f46; }
        .status.not.initialized, .status.error { background-color: #fee2e2; color: #991b1b; }
        .status.unknown { background-color: #fef3c7; color: #92400e; }
        .main-content { display: grid; gap: 2rem; }
        .control-section, .capture-section, .identification-section { background: #f9fafb; padding: 1.5rem; border-radius: 12px; border: 1px solid #e5e7eb; }
        .capture-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: flex-start; }
        .template-controls { display: flex; flex-direction: column; gap: 1.5rem; }
        .template-card, .enrollment-card, .verification-card { border: 1px solid #d1d5db; padding: 1rem; border-radius: 8px; background-color: #ffffff; }
        .enrollment-card h3, .verification-card h3 { border-bottom: none; padding-bottom: 0.5rem; }
        .template-card p { font-size: 0.9rem; color: #6b7280; margin-top: 0; }
        .button-group { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background-color: #3b82f6; color: white; }
        .btn-primary:hover:not(:disabled) { background-color: #2563eb; }
        .btn-secondary { background-color: #6b7280; color: white; }
        .btn-secondary:hover:not(:disabled) { background-color: #4b5563; }
        .btn-warning { background-color: #f59e0b; color: white; width: 100%; margin-top: 1rem; }
        .btn-warning:hover:not(:disabled) { background-color: #d97706; }
        .status-chip { font-size: 0.75rem; font-weight: bold; padding: 0.2rem 0.6rem; border-radius: 12px; }
        .status-chip.success { background-color: #10b981; color: white; }
        .preview-container { text-align: center; }
        .preview-box { margin-top: 1rem; width: 100%; max-width: 400px; height: 375px; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center; margin-left: auto; margin-right: auto; background-color: #f3f4f6; border-radius: 8px; overflow: hidden; }
        .preview-box img { width: 100%; height: 100%; object-fit: contain; }
        .placeholder { color: #6b7280; padding: 1rem; }
        .match-result, .id-result { margin-top: 1rem; padding: 1rem; border-radius: 8px; text-align: left; }
        .match-result h4, .id-result h4 { margin-top: 0; margin-bottom: 0.5rem; }
        .match-result.success, .id-result.success { background-color: #d1fae5; color: #065f46; }
        .match-result.fail, .id-result.fail { background-color: #fee2e2; color: #991b1b; }
        .input-group { display: flex; flex-direction: column; margin-bottom: 1rem; }
        .input-group label { margin-bottom: 0.5rem; font-weight: 500; color: #374151; text-align: left; }
        .form-input { padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; width: 100%; }
        .form-input:disabled { background-color: #e9ecef; cursor: not-allowed; }
        .btn-enroll { width: 100%; background-color: #22c55e; color: white; }
        .btn-enroll:hover:not(:disabled) { background-color: #16a34a; }
        .enroll-note { font-size: 0.8rem; color: #6b7280; margin-top: 1rem; }

        /* --- Gaya baru untuk Identifikasi 1:N --- */
        .btn-identify {
            width: 100%;
            background-color: #6366f1; /* Indigo */
            color: white;
            margin-top: 1rem;
        }
        .btn-identify:hover:not(:disabled) {
            background-color: #4338ca;
        }
        .identify-note { /* Nama kelas diperbaiki dari .indentify-note ke .identify-note */
            font-size: 0.9rem;
            color: #6b7280;
            margin-bottom: 1rem;
        }
        /* --- Akhir gaya baru --- */

        @media (max-width: 860px) { .capture-layout { grid-template-columns: 1fr; } .preview-container { margin-top: 2rem; } }
      `}</style>
    </div>
  );
}
