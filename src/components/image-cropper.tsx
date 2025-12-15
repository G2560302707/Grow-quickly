"use client";

import { useState, useRef, useEffect } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface ImageCropperProps {
    imageSrc: string;
    open: boolean;
    onClose: () => void;
    onCropComplete: (croppedImageBlob: Blob) => void;
}

// Helper to center the crop initially
function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

export function ImageCropper({ imageSrc, open, onClose, onCropComplete }: ImageCropperProps) {
    const { t, language } = useLanguage();
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        // Start with a centered crop covering most of the image
        // Since we want free aspect, we just make a box
        const initialCrop = centerCrop(
            {
                unit: '%',
                width: 80,
                height: 50,
                x: 10,
                y: 25
            },
            width,
            height
        );
        setCrop(initialCrop);
    }

    const getCroppedImg = async (
        image: HTMLImageElement,
        crop: PixelCrop
    ): Promise<Blob | null> => {
        const canvas = document.createElement("canvas");
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width * scaleX;
        canvas.height = crop.height * scaleY;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return null;
        }

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width * scaleX,
            crop.height * scaleY
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Canvas is empty"));
                    return;
                }
                resolve(blob);
            }, "image/jpeg");
        });
    };

    const handleConfirm = async () => {
        if (completedCrop && imgRef.current) {
            try {
                const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
                if (croppedBlob) {
                    onCropComplete(croppedBlob);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            // If no crop, just return original? Or force crop?
            // Let's assume user wants to crop. If they didn't touch it, use current crop state?
            // If crop is undefined, maybe they want whole image?
            // For now, let's require a crop or just use the whole image if nothing selected?
            // Actually, better to just close if they cancel.
            // If they click confirm but no crop is set (unlikely with initial state), do nothing or alert.
            if (!completedCrop && imageSrc) {
                // Fallback: fetch original and return as blob
                try {
                    const res = await fetch(imageSrc);
                    const blob = await res.blob();
                    onCropComplete(blob);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b shrink-0">
                    <DialogTitle>{t.common.cropper?.title || "Crop Image"}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-black w-full overflow-auto flex items-center justify-center p-4">
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-full"
                    >
                        <img
                            ref={imgRef}
                            alt="Crop me"
                            src={imageSrc}
                            onLoad={onImageLoad}
                            style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }}
                        />
                    </ReactCrop>
                </div>

                <div className="p-4 border-t bg-background shrink-0">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                            {t.common.cropper?.hint || "💡 Drag to adjust crop area"}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose}>
                                {t.common.cancel || "Cancel"}
                            </Button>
                            <Button onClick={handleConfirm}>
                                {t.common.confirm || "Confirm"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
