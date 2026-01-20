import React, { useState, useRef } from 'react';
import { Camera, X, Check, User } from 'lucide-react';
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
    const fileInputRef = useRef(null);

    const sizeClasses = {
        sm: 'w-12 h-12',
        md: 'w-20 h-20',
        lg: 'w-28 h-28'
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);

        // Upload to Firebase Storage
        setUploading(true);
        try {
            const storage = getStorage();
            const storageRef = ref(storage, `profile_photos/${profileType}_${profileId}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            onPhotoChange?.(downloadUrl);
            setPreviewUrl(null);
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const displayUrl = previewUrl || currentPhotoUrl;

    return (
        <div className="relative inline-block">
            <button
                onClick={() => fileInputRef.current?.click()}
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
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Camera className="w-3.5 h-3.5" />
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    );
};

export default ProfilePhotoUpload;
