import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, User, Loader2 } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ProfilePhotoUpload = ({
    currentPhotoUrl,
    onPhotoChange,
    profileId,
    profileType, // 'husband', 'wife', or 'kid'
    darkMode = false,
    size = 'md' // 'sm', 'md', 'lg'
}) => {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [showPicker, setShowPicker] = useState(false);
    const [error, setError] = useState(null);
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const sizeClasses = {
        sm: 'w-12 h-12',
        md: 'w-20 h-20',
        lg: 'w-28 h-28'
    };

    const handleOpenPicker = () => {
        setShowPicker(true);
        setError(null);
    };

    const handleCameraClick = () => {
        setShowPicker(false);
        cameraInputRef.current?.click();
    };

    const handleGalleryClick = () => {
        setShowPicker(false);
        galleryInputRef.current?.click();
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so same file can be selected again
        e.target.value = '';

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setError(null);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);

        // Upload to Firebase Storage
        setUploading(true);
        try {
            const storage = getStorage();
            const fileName = `profile_photos/${profileType}_${profileId}_${Date.now()}.jpg`;
            const storageRef = ref(storage, fileName);

            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            console.log('Photo uploaded successfully:', downloadUrl);

            // Call the callback to save to Firestore
            if (onPhotoChange) {
                await onPhotoChange(downloadUrl);
            }

            setPreviewUrl(null);
        } catch (error) {
            console.error('Error uploading photo:', error);
            setError('Upload failed. Check Firebase Storage rules.');
            setPreviewUrl(null);
        } finally {
            setUploading(false);
        }
    };

    const displayUrl = previewUrl || currentPhotoUrl;

    return (
        <>
            <div className="relative inline-block">
                <button
                    onClick={handleOpenPicker}
                    disabled={uploading}
                    className={`${sizeClasses[size]} rounded-full overflow-hidden border-4 transition-all hover:scale-105 active:scale-95 ${darkMode
                        ? 'border-slate-600 bg-slate-700'
                        : 'border-white bg-slate-100 shadow-lg'
                        } ${uploading ? 'opacity-50' : ''}`}
                >
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <User className="w-1/2 h-1/2" />
                        </div>
                    )}
                </button>

                {/* Camera badge */}
                <div
                    className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 ${darkMode
                        ? 'bg-slate-600 border-slate-800 text-white'
                        : 'bg-rose-500 border-white text-white'
                        }`}
                >
                    {uploading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <Camera className="w-3.5 h-3.5" />
                    )}
                </div>

                {/* Error message */}
                {error && (
                    <p className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-red-500 whitespace-nowrap">{error}</p>
                )}

                {/* Hidden file inputs */}
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Picker Modal */}
            {showPicker && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowPicker(false)}
                >
                    <div
                        className={`w-72 p-4 rounded-3xl shadow-2xl space-y-3 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className={`font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Choose Photo</h3>
                            <button
                                onClick={() => setShowPicker(false)}
                                className={`p-1 rounded-full ${darkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <button
                            onClick={handleCameraClick}
                            className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95 ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-rose-50 hover:bg-rose-100'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-rose-900' : 'bg-rose-500'}`}>
                                <Camera className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left">
                                <p className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Take Photo</p>
                                <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Use your camera</p>
                            </div>
                        </button>

                        <button
                            onClick={handleGalleryClick}
                            className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95 ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-purple-50 hover:bg-purple-100'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-purple-900' : 'bg-purple-500'}`}>
                                <ImageIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left">
                                <p className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Choose from Gallery</p>
                                <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pick existing photo</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProfilePhotoUpload;
