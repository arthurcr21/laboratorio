import React, { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileSelected }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const validateAndSelectFile = (file: File | null) => {
    if (!file) return;
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['csv', 'xlsx', 'xls', 'ods'];
    
    if (fileExtension && validExtensions.includes(fileExtension)) {
      onFileSelected(file);
    } else {
      alert('Formato de arquivo inválido. Por favor, envie uma planilha .csv, .xlsx, .xls ou .ods.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`dropzone ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".csv, .xlsx, .xls, .ods"
        onChange={handleChange}
      />
      
      <div className="dropzone-icon">
        <UploadCloud size={40} strokeWidth={1.5} />
      </div>
      
      <h3 className="dropzone-title">Arraste e solte sua planilha aqui</h3>
      <p className="dropzone-subtitle">ou clique para navegar nos seus arquivos</p>
      
      <div className="dropzone-formats">
        Suporta formatos: .xlsx, .xls, .csv, .ods
      </div>
    </div>
  );
};
