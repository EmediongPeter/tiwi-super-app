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
  const [order, setOrder] = useState(1);
  const [link, setLink] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setDescription(item.description || "");
      setCategory(item.category || "Trading");
      setOrder(item.order || 1);
      setLink(item.link || "");
      setThumbnail(item.thumbnail || "");
    } else {
      setTitle("");
      setDescription("");
      setCategory("Trading");
      setOrder(1);
      setLink("");
      setThumbnail("");
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

  const handleSubmit = () => {
    // Here you would save to API
    console.log("Saving Tutorial:", { title, description, category, order, link, thumbnail });
    onOpenChange(false);
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

          {/* Order */}
          <div>
            <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
              min={1}
              className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128]"
              placeholder="Enter display order"
            />
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
              {thumbnail ? (
                <div className="space-y-3">
                  <div className="w-full h-32 bg-[#121712] rounded-lg flex items-center justify-center">
                    <span className="text-[#7c7c7c] text-sm">Thumbnail Preview</span>
                  </div>
                  <button
                    onClick={() => setThumbnail("")}
                    className="text-[#b1f128] text-sm hover:underline"
                  >
                    Remove
                  </button>
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
                  <button
                    onClick={() => {
                      // Handle file upload
                      setThumbnail("thumbnail-url");
                    }}
                    className="bg-[#b1f128] text-[#010501] font-semibold py-2 px-6 rounded-full hover:opacity-90 transition-opacity text-sm"
                  >
                    Browse File
                  </button>
                  <p className="text-xs text-[#7c7c7c] mt-2">
                    Recommended: 400x300px, JPG or PNG
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-[#1f261e]">
            <button
              onClick={handleSubmit}
              disabled={!title || !description || !link}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{item ? "Update" : "Add"} Tutorial</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

