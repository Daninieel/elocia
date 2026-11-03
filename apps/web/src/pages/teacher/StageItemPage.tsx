import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TopHeaderBar from "@/components/teacher/TopHeaderBar";
import Button from "@/components/Button";
import Separator from "@/components/Separator";
import EditStageDialog from "@/components/teacher/EditStageDialog";
import EditStageThumbnailsDialog from "@/components/teacher/EditStageThumbnailsDialog";
import EditSignDialog from "@/components/teacher/EditSignDialog";
import AddSignDialog from "@/components/teacher/AddSignDialog";
import { fetchStageById } from "@/services/curriculum";
import { ChevronLeft, Play, Video, FileText, CheckCircle2, Image as ImageIcon } from "lucide-react";

interface StageSign {
  id: string;
  sign_id: number;
  sign_name: string;
  video_filename: string;
  video_url: string;
  fps: number;
  total_frames: number;
  photo_url?: string;
}

interface StageDetail {
  id: number;
  stage_number: number;
  title: string;
  description: string;
  section_title: string;
  unit_title: string;
  is_active: boolean;
  unit_id?: string;
  signs: StageSign[];
}

export default function TeacherStageItemPage() {
  const { curriculumId, sectionId, unitId, stageId } = useParams<{
    curriculumId: string;
    sectionId: string;
    unitId: string;
    stageId: string;
  }>();

  const navigate = useNavigate();
  const [stage, setStage] = useState<StageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [isThumbnailsModalOpen, setIsThumbnailsModalOpen] = useState(false);
  const [focusSignId, setFocusSignId] = useState<string | number | undefined>(undefined);

  const loadStage = useCallback(() => {
    if (!stageId) return;
    setLoading(true);
    setError(null);

    fetchStageById(stageId)
      .then((data) => {
        setStage(data);
        if (data.signs && data.signs.length > 0) {
          setActiveVideo((prev) => {
            const stillExists = data.signs.some((s: StageSign) => s.video_url === prev);
            return stillExists ? prev : data.signs[0].video_url;
          });
        } else {
          setActiveVideo(null);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load stage details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [stageId]);

  useEffect(() => {
    loadStage();
  }, [loadStage]);

  const backUrl = curriculumId && sectionId && unitId
    ? `/teacher/lessons/curriculum/${curriculumId}/sections/${sectionId}/units/${unitId}`
    : "/teacher/lessons";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopHeaderBar />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Back and Breadcrumbs */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="gap-2 bg-white text-gray-700 hover:bg-gray-100 cursor-pointer"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(backUrl);
              }
            }}
          >
            <ChevronLeft className="size-4" />
            <span>Back to Stages</span>
          </Button>

          {stage && (
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                Active Curriculum Stage
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFocusSignId(undefined);
                  setIsThumbnailsModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs gap-1.5 bg-white text-gray-700 hover:text-(--primary) border-gray-300 hover:bg-amber-50 cursor-pointer"
                title="Manage visual aid thumbnails for all signs in this stage"
              >
                <ImageIcon className="size-3.5 text-amber-500" />
                <span>Visual Aid Thumbnails</span>
              </Button>
              <EditStageDialog
                stage={{
                  id: stage.id,
                  stage_number: stage.stage_number,
                  title: stage.title,
                  description: stage.description,
                  is_active: stage.is_active,
                } as any}
                onUpdated={loadStage}
                onDeleted={() => navigate(backUrl)}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl p-12 border border-gray-200 text-center animate-pulse">
            <div className="h-8 w-64 bg-gray-200 rounded mx-auto mb-4" />
            <div className="h-4 w-96 bg-gray-200 rounded mx-auto" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center text-rose-800">
            <p className="font-semibold">{error}</p>
            <Link to={backUrl} className="mt-4 inline-block">
              <Button className="mt-3">Return to Unit</Button>
            </Link>
          </div>
        ) : stage ? (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--primary)">
                <span>{stage.section_title}</span>
                <span>•</span>
                <span>{stage.unit_title}</span>
                <span>•</span>
                <span>Stage {stage.stage_number}</span>
              </div>
              <h1 className="heading-2 text-gray-900">{stage.title}</h1>
              <p className="text-gray-600 paragraph-1 max-w-3xl">
                {stage.description || "No description provided for this stage."}
              </p>
            </div>

            {/* Content & Baseline Videos Section */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Video className="size-5 text-(--primary)" />
                  <h2 className="heading-3 text-gray-900">Demonstration Video & Signs</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {stage.signs?.length || 0} Sign{stage.signs?.length === 1 ? "" : "s"} Mastered
                  </span>
                  <AddSignDialog
                    stageId={stage.id}
                    gradeLevel={1}
                    onAdded={loadStage}
                  />
                </div>
              </div>

              <Separator />

              {stage.signs && stage.signs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Video Player */}
                  <div className="lg:col-span-2 space-y-3">
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-md border border-gray-200">
                      {activeVideo ? (
                        <video
                          key={activeVideo}
                          src={`http://localhost:8000${activeVideo}`}
                          controls
                          autoPlay
                          playsInline
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="text-gray-400 flex flex-col items-center gap-2">
                          <Play className="size-10 opacity-60" />
                          <span>Select a sign to play demonstration</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Signs / Rounds List */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                      Signs in this Stage
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {stage.signs.map((sign, idx) => {
                        const isSelected = activeVideo === sign.video_url;
                        return (
                          <div
                            key={sign.id || idx}
                            onClick={() => setActiveVideo(sign.video_url)}
                            className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? "border-(--primary) bg-(--primary-light) text-gray-900 shadow-xs"
                                : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected ? "bg-(--primary) text-white" : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusSignId(sign.id || sign.sign_id);
                                  setIsThumbnailsModalOpen(true);
                                }}
                                className="relative group size-10 rounded-lg overflow-hidden bg-white border border-gray-200 p-0.5 shrink-0 shadow-2xs cursor-pointer hover:border-(--primary) transition"
                                title="Click to replace visual aid thumbnail"
                              >
                                {sign.photo_url ? (
                                  <img
                                    src={`http://localhost:8000${sign.photo_url}`}
                                    alt={sign.sign_name}
                                    className="h-full w-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 bg-gray-50">
                                    🖼️
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[9px] font-bold">
                                  Edit
                                </div>
                              </div>
                              <div className="truncate">
                                <p className="font-semibold text-sm truncate">{sign.sign_name}</p>
                                <p className="text-xs text-gray-400 truncate">
                                  {sign.total_frames ? `${sign.total_frames} frames (${sign.fps || 30} fps)` : "Sign video"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <EditSignDialog sign={sign} onUpdated={loadStage} />
                              <Play className={`size-4 ${isSelected ? "text-(--primary)" : "text-gray-400"}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-gray-50 border border-dashed border-gray-300 text-center space-y-3">
                  <FileText className="size-10 text-gray-400 mx-auto" />
                  <h3 className="font-bold text-gray-800">No Videos Linked Yet</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    This stage does not have demonstration video baselines attached yet. You can click &quot;Add Sign Video&quot; above to add sign demonstration rounds.
                  </p>
                  <div className="pt-2 flex justify-center">
                    <AddSignDialog
                      stageId={stage.id}
                      gradeLevel={1}
                      onAdded={loadStage}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
        {stage && (
          <EditStageThumbnailsDialog
            isOpen={isThumbnailsModalOpen}
            onClose={() => {
              setIsThumbnailsModalOpen(false);
              setFocusSignId(undefined);
            }}
            stageId={stage.id}
            stageTitle={stage.title}
            stageNumber={stage.stage_number}
            initialSigns={stage.signs}
            focusSignId={focusSignId}
            onUpdated={loadStage}
          />
        )}
      </main>
    </div>
  );
}
