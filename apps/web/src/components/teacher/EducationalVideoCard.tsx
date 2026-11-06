import { useState } from "react";
import type { EducationalVideo } from "@/interfaces/educational-video.interface";
import { Pencil, Trash2, Video as VideoIcon, Play, X } from "lucide-react";
import EditEducationalVideoDialog from "./EditEducationalVideoDialog";
import DeleteEducationalVideoDialog from "./DeleteEducationalVideoDialog";

interface EducationalVideoCardProps {
  video: EducationalVideo;
  onRefresh?: () => void;
}

export default function EducationalVideoCard({
  video,
  onRefresh,
}: EducationalVideoCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <>
      <article className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-3 border-(--border) bg-(--white) shadow-[0_6px_0_0_#BDC8D2] transition-all hover:-translate-y-1 hover:shadow-[0_10px_0_0_#BDC8D2]">
        {/* Video Thumbnail (Clickable to preview) */}
        <div 
          onClick={() => setIsPreviewOpen(true)}
          className="relative aspect-video w-full overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer select-none"
          title="Click to watch preview"
        >
          {video.thumbnailUrl && !imgError ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
              <VideoIcon className="size-10 stroke-1" />
              <span className="text-xs font-semibold">{video.subject || "Video"}</span>
            </div>
          )}

          {/* Hover Play Button Overlay */}
          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-(--primary) pl-1 transition-transform group-hover:scale-110">
              <Play className="size-6 fill-current" />
            </div>
          </div>

          <div className="absolute top-3 left-3">
            <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full shadow-sm bg-orange-500 text-white">
              Grade {video.gradeLevel}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <span className="text-[11px] font-bold bg-white/90 backdrop-blur-xs text-gray-800 px-2.5 py-1 rounded-full shadow-sm border border-gray-200">
              {video.subject}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-col flex-1 justify-between p-5 gap-4">
          <div className="space-y-1.5">
            <h2 
              onClick={() => setIsPreviewOpen(true)}
              className="heading-4 font-bold text-gray-900 line-clamp-1 cursor-pointer hover:text-(--primary) transition-colors"
              title={video.title}
            >
              {video.title}
            </h2>
            <p className="caption text-gray-500 line-clamp-2">
              {video.description || `Learn ${video.subject} concepts with Filipino Sign Language.`}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 pt-2 border-t border-gray-100">
            <span>{video.durationMinutes || 5} min</span>
            <span className="text-gray-400">
              {video.createdAt ? new Date(video.createdAt).toLocaleDateString() : ""}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-(--primary) hover:opacity-90 text-xs font-bold text-white transition-opacity cursor-pointer shadow-sm"
              title="Watch Video Preview"
            >
              <Play className="size-3.5 fill-current" />
              <span>Watch Video</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-(--primary-light) hover:bg-(--primary)/20 text-xs font-bold text-(--primary) transition-colors cursor-pointer"
                title="Edit Video Details"
              >
                <Pencil className="size-3.5" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
                title="Delete Video"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Video Preview Modal */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border-2 border-gray-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-4 px-6 bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                    {video.subject}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
                    Grade {video.gradeLevel}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{video.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors cursor-pointer"
                title="Close Video"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Video Player Box */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              <video
                src={video.videoUrl}
                controls
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Modal Description Footer */}
            {video.description && (
              <div className="p-4 px-6 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                  {video.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditEducationalVideoDialog
        isOpen={isEditOpen}
        video={video}
        onClose={() => setIsEditOpen(false)}
        onUpdated={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* Delete Modal */}
      <DeleteEducationalVideoDialog
        isOpen={isDeleteOpen}
        videoId={video.id}
        videoTitle={video.title}
        onClose={() => setIsDeleteOpen(false)}
        onDeleted={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </>
  );
}
