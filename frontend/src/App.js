import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  
  const [selectedFile, setSelectedFile] = useState(null); 
  const [fileName, setFileName] = useState(''); 
  const [fileSize, setFileSize] = useState(0); 
  const [fileType, setFileType] = useState(''); 
  const [uploadedFileContent, setUploadedFileContent] = useState(null); 

  // Changed default selected algorithm from 'huffman' to 'lz77'
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('lz77'); 
  const [operationType, setOperationType] = useState('compress'); 
  const [processingResult, setProcessingResult] = useState(null); 
  const [message, setMessage] = useState(''); 
  const [messageType, setMessageType] = useState(''); 
  const [loading, setLoading] = useState(false); 
 
  const fileInputRef = useRef(null);

  
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(''); 
        setMessageType(''); 
      }, 5000); 
      return () => clearTimeout(timer); 
    }
  }, [message]); 

  
  const handleFileChange = (event) => {
    
    const file = event.target.files ? event.target.files[0] : event.dataTransfer.files[0];

    if (file) {
      
      if (file.size > 50 * 1024 * 1024) { 
        showMessage('File is too large. Max 50MB allowed for demo.', 'error');
        
        setSelectedFile(null);
        setFileName('');
        setFileSize(0);
        setFileType('');
        setUploadedFileContent(null);
        return; 
      }

      
      setSelectedFile(file);
      setFileName(file.name);
      setFileSize(file.size);
      setFileType(file.type); 
      setProcessingResult(null); 

      
      const reader = new FileReader();
      reader.onload = (e) => {
        
        if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml') || file.type.includes('svg')) {
          setUploadedFileContent(e.target.result); 
        } else if (file.type.startsWith('image/')) {
          setUploadedFileContent(e.target.result); 
        } else {
          setUploadedFileContent(null); 
          showMessage('Preview not available for this file type.', 'info');
        }
      };

      
      if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml') || file.type.includes('svg')) {
        reader.readAsText(file); 
      } else if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file); 
      } else {
        
      }

      showMessage(`File '${file.name}' (${(file.size / 1024).toFixed(2)} KB) selected.`, 'info'); // Tell the user the file is selected
    } else {
      
      setSelectedFile(null);
      setFileName('');
      setFileSize(0);
      setFileType('');
      setUploadedFileContent(null);
      showMessage('No file selected.', 'info');
    }
  };


  
  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  
  const handleDragOver = (event) => {
    event.preventDefault(); 
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy'; 
  };

  
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleFileChange(event); 
  };

  
  const processFile = async () => {
    if (!selectedFile) {
      showMessage('Please select a file first.', 'error');
      return;
    }

    setLoading(true); 
    setMessage('Processing file...');
    setMessageType('info');
    setProcessingResult(null); 

    try {
      
      const formData = new FormData();
      formData.append('file', selectedFile); 
      formData.append('algorithm', selectedAlgorithm); 
      formData.append('operation', operationType);     
      formData.append('originalSize', fileSize);      

      
      const response = await fetch('http://localhost:5000/api/process-file', {
        method: 'POST', 
        body: formData, 
      });

      
      if (!response.ok) {
        const errorData = await response.json(); 
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json(); 

      if (data.success) {
        
        const processedFileBlob = base64toBlob(data.processedFileBase64, data.mimeType);

        
        setProcessingResult({
          originalSize: data.originalSize,
          processedSize: data.processedSize,
          compressionRatio: data.compressionRatio,
          processingTime: data.processingTime,
          processedFileBlob: processedFileBlob, 
          processedFileName: data.fileName, 
        });
        showMessage(`File ${operationType === 'compress' ? 'compressed' : 'decompressed'} successfully!`, 'success');
      } else {
        showMessage(`Backend error: ${data.message}`, 'error');
      }

    } catch (error) {
      
      console.error('Error processing file:', error);
      showMessage(`Error processing file: ${error.message}. Please ensure the backend server is running.`, 'error');
    } finally {
      setLoading(false); 
    }
  };

  
  const base64toBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64); 
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers); 
    return new Blob([byteArray], { type: mimeType }); 
  };

  
  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
  };

  
  const handleDownload = () => {
    if (processingResult && processingResult.processedFileBlob) {
      const url = URL.createObjectURL(processingResult.processedFileBlob); 
      const link = document.createElement('a'); 
      link.href = url; 

      let newFileName;
      const originalFileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
      const originalFileExtension = fileName.split('.').pop();

      if (operationType === 'compress') {
        
        newFileName = `${originalFileNameWithoutExt}_compressed_with_${selectedAlgorithm}.comp`;
        
      } else {
        
        newFileName = `${originalFileNameWithoutExt}_decompressed_with_${selectedAlgorithm}.${originalFileExtension}`;
      }

      link.setAttribute('download', newFileName); 
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link); 
      URL.revokeObjectURL(url); 
      showMessage('File download initiated!', 'success');
    } else {
      showMessage('No processed file available for download.', 'error');
    }
  };

  
  const algorithmDescriptions = {
    
    rle: {
      name: 'Run-Length Encoding (RLE)',
      description: 'Simple compression that replaces repeated characters (like "AAAAA") with a count (like "5A"). Good for simple images. (Uses real custom implementation)',
    },
    lz77: {
      name: 'LZ77',
      description: 'Compresses data by finding repeated patterns and replacing them with references to where they appeared before. Used in popular formats like ZIP. (Uses real zlib Deflate/Inflate)',
    },
  };

  
  return (
    
    <div className="app-container-outer"> {}
      <div className="app-container"> {}
        <h1 className="main-heading">
          File Compression & Decompression Portal
        </h1>

        {}
        <section className="app-section">
            <h2 className="section-heading">Understanding the Algorithms</h2>
          {Object.entries(algorithmDescriptions).map(([key, algo]) => (
            <details key={key} className="algorithm-details"> {}
              <summary>{algo.name}</summary>
              <p>{algo.description}</p>
            </details>
          ))}
        </section>

        {}
        {}
        <section className="app-section upload-section-red">
          <h2 className="section-heading">1. Upload Your File</h2>
          <div
            className="drop-zone" 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <p>Drag & drop your file here, or</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }} 
            />
            <button
              onClick={handleBrowseClick}
              className="browse-button"
            >
              Browse Files
            </button>
          </div>
          {fileName && ( 
            <div className="file-info"> {}
              Selected File: <span>{fileName}</span> ({(fileSize / 1024).toFixed(2)} KB)
            </div>
          )}

          {}
          {uploadedFileContent && (
            <div className="file-preview-container">
              <h3>File Content Preview:</h3>
              {fileType.startsWith('image/') ? (
                <img src={uploadedFileContent} alt="File Preview" className="file-preview-image" />
              ) : (
                <pre className="file-preview-text">{uploadedFileContent}</pre> 
              )}
            </div>
          )}
        </section>

        {}
        <section className="app-section">
          <h2 className="section-heading">2. Choose Algorithm & Operation</h2>

          {}
          <div style={{ marginBottom: '25px' }}> {}
            <h3 className="section-heading" style={{ fontSize: '1.2em', marginBottom: '15px' }}>Select Algorithm:</h3>
            <div className="radio-group"> {}
              {}
              {['rle', 'lz77'].map(algo => (
                <label key={algo} className="radio-label"> {}
                  <input
                    type="radio"
                    name="algorithm"
                    value={algo}
                    checked={selectedAlgorithm === algo}
                    onChange={() => setSelectedAlgorithm(algo)}
                  />
                  <span style={{ textTransform: 'capitalize' }}> {}
                    {algorithmDescriptions[algo].name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {}
          <div>
            <h3 className="section-heading" style={{ fontSize: '1.2em', marginBottom: '15px' }}>Select Operation:</h3>
            <div className="radio-group"> {}
              {}
              <label className="radio-label compress"> {}
                <input
                  type="radio"
                  name="operation"
                  value="compress"
                  checked={operationType === 'compress'}
                  onChange={() => setOperationType('compress')}
                />
                <span>Compress</span>
              </label>
              <label className="radio-label decompress"> {}
                <input
                  type="radio"
                  name="operation"
                  value="decompress"
                  checked={operationType === 'decompress'}
                  onChange={() => setOperationType('decompress')}
                />
                <span>Decompress</span>
              </label>
            </div>
          </div>
        </section>

        {}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}> {}
          <button
            onClick={processFile}
            disabled={!selectedFile || loading} 
            className="process-button" 
          >
            {loading ? 'Processing...' : `Process File (${operationType.charAt(0).toUpperCase() + operationType.slice(1)})`}
          </button>
        </div>

        {}
        {message && (
          <div
            className={`message-box ${messageType}`} 
          >
            {message}
          </div>
        )}

        {}
        {processingResult && ( 
          <section className="results-section"> {}
            <h2 className="section-heading">3. Processing Results</h2>
            <div className="results-grid"> {}
              <div className="result-item"> {}
                <span>Original Size:</span>
                <span>{processingResult.originalSize} bytes</span>
              </div>
              <div className="result-item">
                <span>Processed Size:</span>
                <span>{processingResult.processedSize} bytes</span>
              </div>
              <div className="result-item">
                <span>Compression Ratio:</span>
                <span>{processingResult.compressionRatio}</span>
              </div>
              <div className="result-item">
                <span>Processing Time:</span>
                <span>{processingResult.processingTime} ms</span>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}> {}
              <button
                onClick={handleDownload}
                className="download-button" 
              >
                Download Processed File
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default App;
