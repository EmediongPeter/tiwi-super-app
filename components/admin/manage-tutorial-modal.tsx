"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IoChevronDownOutline, IoCloudUploadOutline } from "react-icons/io5";

interface ManageTutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
}

const categories = [
  "Trading",
  "Liquidity",
  "Staking",
  "NFTs",
  "Social",
  "Security",
  "Getting Started",
  "Advanced",
];

export default function ManageTutorialModal({
  open,
  onOpenChange,
  item,
}: ManageTutorialModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Trading");
  const [link, setLink] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (item) {
        setTitle(item.title || "");
        setDescription(item.description || "");
        setCategory(item.category || "Trading");
        setLink(item.link || "");
        const thumbUrl = item.thumbnailUrl || item.thumbnail || "";
        setThumbnail(thumbUrl);
        setThumbnailPreview(thumbUrl);
        setThumbnailFile(null);
      } else {
        setTitle("");
        setDescription("");
        setCategory("Trading");
        setLink("");
        setThumbnail("");
        setThumbnailPreview("");
        setThumbnailFile(null);
      }
    } else {
      // Reset when modal closes
      setTitle("");
      setDescription("");
      setCategory("Trading");
      setLink("");
      setThumbnail("");
      setThumbnailPreview("");
      setThumbnailFile(null);
      setShowCategoryDropdown(false);
    }
  }, [item, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert("File size must be less than 5MB");
      return;
    }

    setThumbnailFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload thumbnail file
  const uploadThumbnail = async (): Promise<string | undefined> => {
    if (!thumbnailFile) {
      return thumbnail || undefined;
    }

    setIsUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append('file', thumbnailFile);
      formData.append('folder', 'tutorials');

      const response = await fetch('/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload thumbnail');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      throw error;
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  // Remove thumbnail
  const handleRemoveThumbnail = () => {
    setThumbnail("");
    setThumbnailPreview("");
    setThumbnailFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !link) {
      alert("Please fill in title, description, and link");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload thumbnail if a new file was selected
      let thumbnailUrl: string | undefined = thumbnail || undefined;
      if (thumbnailFile) {
        const uploadedUrl = await uploadThumbnail();
        if (!uploadedUrl) {
          throw new Error("Failed to upload thumbnail");
        }
        thumbnailUrl = uploadedUrl;
      }

      const url = "/api/v1/tutorials";
      const method = item ? "PATCH" : "POST";
      const body = item
        ? { 
            id: item.id, 
            title, 
            description, 
            category, 
            link,
            thumbnailUrl: thumbnailUrl || undefined
          }
        : { 
            title, 
            description, 
            category, 
            link,
            thumbnailUrl: thumbnailUrl || undefined
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Reset form
        setTitle("");
        setDescription("");
        setCategory("Trading");
        setLink("");
        setThumbnail("");
        setThumbnailPreview("");
        setThumbnailFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onOpenChange(false);
        // Trigger refresh in parent component
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tutorialUpdated"));
        }
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save tutorial");
      }
    } catch (error: any) {
      console.error("Error saving tutorial:", error);
      alert(error.message || "Failed to save tutorial. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between mb-6">
          <DialogTitle className="text-xl font-semibold text-white">
            {item ? "Edit" : "Add"} Tutorial
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#b1f128] hover:text-[#9dd81f] transition-colors"
          >
            X Cancel
          </button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128]"
              placeholder="Enter tutorial title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128] resize-none"
              placeholder="Enter tutorial description"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative" ref={categoryRef}>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Category
            </label>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white flex items-center justify-between hover:border-[#b1f128] transition-colors"
            >
              <span>{category}</span>
              <IoChevronDownOutline className="w-5 h-5 text-[#b5b5b5]" />
            </button>
            {showCategoryDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg p-2">
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        category === cat
                          ? "bg-[#b1f128] text-[#010501]"
                          : "bg-[#121712] border border-[#1f261e] text-[#b5b5b5] hover:bg-[#1a1f1a] hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Link/URL */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Tutorial Link
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128]"
              placeholder="https://example.com/tutorial or /internal-route"
            />
            <p className="text-xs text-[#7c7c7c] mt-2">
              Enter the URL where users will be redirected when they click this tutorial
            </p>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Thumbnail
            </label>
            <div className="border-2 border-dashed border-[#1f261e] rounded-xl p-8 text-center bg-[#0b0f0a]">
              {thumbnailPreview ? (
                <div className="space-y-3">
                  <div className="w-full h-48 bg-[#121712] rounded-lg flex items-center justify-center overflow-hidden">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#b1f128] text-sm hover:underline"
                      disabled={isUploadingThumbnail}
                    >
                      Change
                    </button>
                    <span className="text-[#7c7c7c]">|</span>
                    <button
                      type="button"
                      onClick={handleRemoveThumbnail}
                      className="text-[#ff5c5c] text-sm hover:underline"
                      disabled={isUploadingThumbnail}
                    >
                      Remove
                    </button>
                  </div>
                  {thumbnailFile && (
                    <p className="text-xs text-[#7c7c7c]">
                      {thumbnailFile.name} ({(thumbnailFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <IoCloudUploadOutline
                    size={32}
                    className="text-[#b5b5b5] mx-auto mb-3"
                  />
                  <p className="text-sm text-[#b5b5b5] mb-3">
                    Drag or drop files here or browse your computer.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingThumbnail}
                    className="bg-[#b1f128] text-[#010501] font-semibold py-2 px-6 rounded-full hover:opacity-90 transition-opacity text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingThumbnail ? "Uploading..." : "Browse File"}
                  </button>
                  <p className="text-xs text-[#7c7c7c] mt-2">
                    Recommended: 400x300px, JPG or PNG (Max 5MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-[#1f261e]">
            <button
              onClick={handleSubmit}
              disabled={!title || !description || !link || isSubmitting || isUploadingThumbnail}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {isUploadingThumbnail 
                  ? "Uploading..." 
                  : isSubmitting 
                    ? "Saving..." 
                    : item 
                      ? "Update" 
                      : "Add"} Tutorial
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

