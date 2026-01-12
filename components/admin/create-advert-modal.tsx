"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IoChevronDownOutline, IoCloudUploadOutline } from "react-icons/io5";

interface CreateAdvertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const campaignTypes = [
  { label: "Banner Ad", value: "banner" },
  { label: "Video Ad", value: "video" },
  { label: "Interactive Ad", value: "interactive" },
];

const advertFormats = [
  { label: "Full Width", value: "full-width" },
  { label: "Half Width", value: "half-width" },
  { label: "Square", value: "square" },
];

const audiences = [
  { label: "All Users", value: "all-users" },
  { label: "By Network", value: "by-network" },
  { label: "By Activity", value: "by-activity" },
];

const priorities = [
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

export default function CreateAdvertModal({
  open,
  onOpenChange,
}: CreateAdvertModalProps) {
  const [advertName, setAdvertName] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCampaignType, setSelectedCampaignType] = useState("Banner Ad");
  const [selectedFormat, setSelectedFormat] = useState("Full Width");
  const [headline, setHeadline] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedAudience, setSelectedAudience] = useState("All Users");
  const [selectedPriority, setSelectedPriority] = useState("Normal");
  const [compliance, setCompliance] = useState({
    "Content is appropriate": false,
    "No misleading claims": false,
    "Compliant with regulations": false,
  });

  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showAudienceDropdown, setShowAudienceDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const campaignRef = useRef<HTMLDivElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);
  const audienceRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (campaignRef.current && !campaignRef.current.contains(event.target as Node)) {
        setShowCampaignDropdown(false);
      }
      if (formatRef.current && !formatRef.current.contains(event.target as Node)) {
        setShowFormatDropdown(false);
      }
      if (audienceRef.current && !audienceRef.current.contains(event.target as Node)) {
        setShowAudienceDropdown(false);
      }
      if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplianceChange = (key: string) => {
    setCompliance((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  const handleSubmit = async () => {
    if (!advertName.trim()) {
      alert("Please enter an advert name");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to create advert
      console.log("Creating advert:", {
        advertName,
        selectedImage,
        selectedCampaignType,
        selectedFormat,
        headline,
        messageBody,
        selectedAudience,
        selectedPriority,
        compliance,
      });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset form
      setAdvertName("");
      setSelectedImage(null);
      setSelectedCampaignType("Banner Ad");
      setSelectedFormat("Full Width");
      setHeadline("");
      setMessageBody("");
      setSelectedAudience("All Users");
      setSelectedPriority("Normal");
      setCompliance({
        "Content is appropriate": false,
        "No misleading claims": false,
        "Compliant with regulations": false,
      });

      onOpenChange(false);
      alert("Advert created successfully!");
    } catch (error) {
      console.error("Error creating advert:", error);
      alert("Failed to create advert. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#121712] border-[#1f261e] text-white w-fit max-w-[90vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-center justify-between mb-6">
            <DialogTitle className="text-xl font-semibold text-white">
              Create Advert
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-[#b1f128] hover:text-[#9dd81f] transition-colors font-medium"
            >
              Close
            </button>
          </DialogHeader>

          <div className="space-y-6">
            {/* Advert Name */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Advert Name *
              </label>
              <input
                type="text"
                value={advertName}
                onChange={(e) => setAdvertName(e.target.value)}
                placeholder="Enter advert name"
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#b1f128]"
              />
            </div>

            {/* Attach Image */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Attach Image
              </label>
              <div className="w-full h-64 bg-[#0b0f0a] border border-[#1f261e] rounded-lg overflow-hidden flex items-center justify-center relative">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt="Advert preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                    <IoCloudUploadOutline className="w-12 h-12 text-[#7c7c7c] mb-2" />
                    <span className="text-[#7c7c7c] text-sm">Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Campaign Type */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Campaign Type
              </label>
              <div className="relative" ref={campaignRef}>
                <button
                  onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm flex items-center justify-between hover:border-[#b1f128] transition-colors"
                >
                  <span>{selectedCampaignType}</span>
                  <IoChevronDownOutline className="w-4 h-4" />
                </button>
                {showCampaignDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                    {campaignTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setSelectedCampaignType(type.label);
                          setShowCampaignDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#121712] transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Advert Format */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Advert Format
              </label>
              <div className="relative" ref={formatRef}>
                <button
                  onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm flex items-center justify-between hover:border-[#b1f128] transition-colors"
                >
                  <span>{selectedFormat}</span>
                  <IoChevronDownOutline className="w-4 h-4" />
                </button>
                {showFormatDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                    {advertFormats.map((format) => (
                      <button
                        key={format.value}
                        onClick={() => {
                          setSelectedFormat(format.label);
                          setShowFormatDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#121712] transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Headline */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Headline (max 60 chars)
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value.slice(0, 60))}
                placeholder="Enter headline"
                maxLength={60}
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#b1f128]"
              />
              <div className="text-[#7c7c7c] text-xs mt-1 text-right">
                {headline.length}/60
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Message Body
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Enter message body"
                rows={5}
                className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#b1f128] resize-none"
              />
            </div>

            {/* Audience Targeting */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Audience Targeting
              </label>
              <div className="relative" ref={audienceRef}>
                <button
                  onClick={() => setShowAudienceDropdown(!showAudienceDropdown)}
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm flex items-center justify-between hover:border-[#b1f128] transition-colors"
                >
                  <span>{selectedAudience}</span>
                  <IoChevronDownOutline className="w-4 h-4" />
                </button>
                {showAudienceDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                    {audiences.map((audience) => (
                      <button
                        key={audience.value}
                        onClick={() => {
                          setSelectedAudience(audience.label);
                          setShowAudienceDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#121712] transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {audience.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Priority Level
              </label>
              <div className="relative" ref={priorityRef}>
                <button
                  onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                  className="w-full bg-[#0b0f0a] border border-[#1f261e] rounded-lg px-4 py-2.5 text-white text-sm flex items-center justify-between hover:border-[#b1f128] transition-colors"
                >
                  <span>{selectedPriority}</span>
                  <IoChevronDownOutline className="w-4 h-4" />
                </button>
                {showPriorityDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-[#0b0f0a] border border-[#1f261e] rounded-lg shadow-lg">
                    {priorities.map((priority) => (
                      <button
                        key={priority.value}
                        onClick={() => {
                          setSelectedPriority(priority.label);
                          setShowPriorityDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#121712] transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {priority.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Compliance Review */}
            <div>
              <label className="block text-[#b5b5b5] text-sm font-medium mb-2">
                Compliance Review
              </label>
              <div className="space-y-2">
                {Object.entries(compliance).map(([item, checked]) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => handleComplianceChange(item)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        checked
                          ? "bg-[#b1f128] border-[#b1f128]"
                          : "border-[#1f261e] bg-[#0b0f0a]"
                      }`}
                    >
                      {checked && (
                        <svg
                          className="w-3 h-3 text-[#010501]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-[#b5b5b5] text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 px-6 py-2.5 bg-[#121712] border border-[#1f261e] text-[#b5b5b5] rounded-lg hover:bg-[#1a1f1a] hover:text-white transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !advertName.trim()}
                className="flex-1 px-6 py-2.5 bg-[#b1f128] text-[#010501] rounded-lg hover:bg-[#9dd81f] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : "Create Advert"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
