import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopHeaderBar from "@/components/teacher/TopHeaderBar";
import Button from "@/components/Button";
import Separator from "@/components/Separator";
import EditMiniGameDialog from "@/components/teacher/EditMiniGameDialog";
import DeleteMiniGameDialog from "@/components/teacher/DeleteMiniGameDialog";
import { fetchMiniGameDetails, resolveMediaUrl } from "@/services/mini-games";
import type { MiniGameConfig } from "@/interfaces/mini-game.interface";
import { snakeCaseToTitleCase } from "@/helpers/string";
import {
  ChevronLeft,
  Pencil,
  Trash2,
  Video,
  Play,
  Image as ImageIcon,
  Loader2,
  Calendar,
} from "lucide-react";

export default function TeacherViewMiniGamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<MiniGameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video Theater state
  const [activeVideoRound, setActiveVideoRound] = useState<number>(0);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const loadGame = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchMiniGameDetails(id)
      .then((data) => {
        setGame(data);
        // Find first available video
        let firstVideo: string | null = null;
        if (data.game_type === "see_it_sign_it" && data.see_it_sign_it_items) {
          firstVideo = data.see_it_sign_it_items[0]?.reference_video_url || null;
        } else if (data.game_type === "puzzle_sign" && data.puzzle_sign_items) {
          firstVideo = data.puzzle_sign_items[0]?.reference_video_url || null;
        } else if (data.game_type === "magic_fingers" && data.magic_fingers_items) {
          firstVideo = data.magic_fingers_items[0]?.reference_video_url || null;
        }
        setActiveVideoUrl(firstVideo);
        setActiveVideoRound(0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load mini-game details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopHeaderBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 text-(--primary) animate-spin" />
          <p className="text-sm font-semibold text-gray-500">Loading activity details...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopHeaderBar />
        <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
          <Button
            variant="outline"
            className="gap-2 bg-white cursor-pointer"
            onClick={() => navigate("/teacher/lessons")}
          >
            <ChevronLeft className="size-4" /> Back to Lessons
          </Button>
          <div className="rounded-3xl bg-rose-50 border border-rose-200 p-8 text-center space-y-3">
            <h2 className="heading-3 text-rose-700">Unable to load activity</h2>
            <p className="text-sm text-rose-600">{error || "Game not found"}</p>
          </div>
        </main>
      </div>
    );
  }

  // Round items helpers
  const sisiItems = game.see_it_sign_it_items || [];
  const puzzleItems = game.puzzle_sign_items || [];
  const magicItems = game.magic_fingers_items || [];

  const roundCount =
    game.game_type === "see_it_sign_it"
      ? sisiItems.length
      : game.game_type === "puzzle_sign"
        ? puzzleItems.length
        : magicItems.length;

  const gameTypeStyles: Record<string, string> = {
    see_it_sign_it: "bg-blue-600 text-white",
    puzzle_sign: "bg-emerald-600 text-white",
    magic_fingers: "bg-purple-600 text-white",
  };

  const difficultyLabels: Record<number, string> = {
    1: "Easy",
    2: "Medium",
    3: "Hard",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-16">
      <TopHeaderBar />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-8">
        {/* Navigation & Header Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="gap-2 bg-white text-gray-700 hover:bg-gray-100 cursor-pointer shadow-xs"
            onClick={() => navigate("/teacher/lessons")}
          >
            <ChevronLeft className="size-4" />
            <span>Back to Lessons</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="gap-2 cursor-pointer bg-(--primary) text-white shadow-sm"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="size-4" />
              <span>Edit Activity & Media</span>
            </Button>
            <Button
              type="button"
              className="gap-2 cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              <span>Delete</span>
            </Button>
          </div>
        </div>

        {/* Hero Card */}
        <article className="overflow-hidden rounded-3xl border-3 border-(--border) bg-white p-6 shadow-[0_6px_0_0_#BDC8D2] space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    gameTypeStyles[game.game_type] || "bg-gray-800 text-white"
                  }`}
                >
                  {snakeCaseToTitleCase(game.game_type)}
                </span>
                <span className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200">
                  {difficultyLabels[game.difficulty || 1] || "Easy"}
                </span>
                <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                  {roundCount} {roundCount === 1 ? "Round" : "Rounds"}
                </span>
              </div>
              <h1 className="heading-1 text-gray-900">{game.title}</h1>
              <p className="text-sm text-gray-500 max-w-3xl leading-relaxed">
                {game.description || "No description provided."}
              </p>
            </div>

            {game.created_at && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 self-start md:self-auto">
                <Calendar className="size-4" />
                <span>Uploaded: {new Date(game.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </article>

        {/* Video Theater Preview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="size-5 text-(--primary)" />
              <h2 className="heading-3 text-gray-900">Reference Video Preview Theater</h2>
            </div>
            <span className="caption text-gray-500">
              Select a round below to preview its reference demonstration
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 rounded-3xl border-3 border-(--border) bg-white p-6 shadow-[0_6px_0_0_#BDC8D2]">
            {/* Player */}
            <div className="lg:col-span-2 flex flex-col justify-center items-center bg-black rounded-2xl overflow-hidden aspect-video relative">
              {activeVideoUrl ? (
                <video
                  key={activeVideoUrl}
                  src={resolveMediaUrl(activeVideoUrl)}
                  controls
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLVideoElement;
                    if (!target.dataset.triedFallback && activeVideoUrl) {
                      target.dataset.triedFallback = "true";
                      const filename = activeVideoUrl.split("?")[0].split("/").pop();
                      target.src = `https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media/videos/${filename}`;
                      target.load();
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-gray-400 p-8 text-center">
                  <Video className="size-12 text-gray-600" />
                  <p className="text-sm font-semibold">
                    No reference video uploaded for Round {activeVideoRound + 1}
                  </p>
                  <Button
                    variant="outline"
                    className="text-xs text-white border-gray-600 hover:bg-gray-800"
                    onClick={() => setIsEditOpen(true)}
                  >
                    Upload Video in Edit Dialog
                  </Button>
                </div>
              )}
            </div>

            {/* Round Switcher Playlist */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Playlist Rounds
              </h3>
              {Array.from({ length: roundCount }).map((_, rIdx) => {
                let rVideo: string | null = null;
                let rLabel = `Round ${rIdx + 1}`;

                if (game.game_type === "see_it_sign_it" && sisiItems[rIdx]) {
                  rVideo = sisiItems[rIdx].reference_video_url || null;
                  rLabel = `Round ${rIdx + 1}: ${sisiItems[rIdx].objective_answer || "Unlabeled"}`;
                } else if (game.game_type === "puzzle_sign" && puzzleItems[rIdx]) {
                  rVideo = puzzleItems[rIdx].reference_video_url || null;
                  rLabel = `Round ${rIdx + 1}: ${puzzleItems[rIdx].word_form || "Compound"}`;
                } else if (game.game_type === "magic_fingers" && magicItems[rIdx]) {
                  rVideo = magicItems[rIdx].reference_video_url || null;
                  rLabel = `Round ${rIdx + 1}: ${magicItems[rIdx].word || "Word"}`;
                }

                const isActive = activeVideoRound === rIdx;

                return (
                  <button
                    key={rIdx}
                    type="button"
                    onClick={() => {
                      setActiveVideoRound(rIdx);
                      setActiveVideoUrl(rVideo);
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? "border-(--primary) bg-(--primary-light) shadow-xs"
                        : "border-gray-200 bg-gray-50/50 hover:bg-gray-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isActive
                            ? "bg-(--primary) text-white"
                            : "bg-white text-gray-600 border border-gray-200"
                        }`}
                      >
                        {rIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-gray-800 line-clamp-1">
                        {rLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {rVideo ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <Play className="size-2.5 fill-current" /> Ready
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          No Video
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <Separator />

        {/* Rounds Breakdown Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="heading-3 text-gray-900">Round Details & Prompts</h2>
            <Button
              type="button"
              variant="outline"
              className="gap-2 cursor-pointer bg-white"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="size-3.5" />
              <span>Modify Rounds</span>
            </Button>
          </div>

          {/* 1. SEE IT SIGN IT BREAKDOWN */}
          {game.game_type === "see_it_sign_it" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sisiItems.map((item, idx) => (
                <article
                  key={idx}
                  className="rounded-3xl border-2 border-gray-200 bg-white p-5 shadow-sm space-y-4 hover:border-(--primary)/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="size-8 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-400">
                      Round {idx + 1} of {sisiItems.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Target Sign
                    </span>
                    <h3 className="heading-3 font-bold text-blue-600">
                      {item.objective_answer}
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Objective Image
                    </span>
                    <div className="aspect-video w-full rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {item.objective_image_url ? (
                        <img
                          src={resolveMediaUrl(item.objective_image_url)}
                          alt={item.objective_answer}
                          className="h-full w-full object-contain p-2"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.dataset.triedFallback && item.objective_image_url) {
                              target.dataset.triedFallback = "true";
                              const filename = item.objective_image_url.split("?")[0].split("/").pop();
                              target.src = `https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media/thumbnails/${filename}`;
                            } else {
                              target.style.display = "none";
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-400 text-xs">
                          <ImageIcon className="size-6" />
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Video Demonstration:</span>
                    {item.reference_video_url ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVideoRound(idx);
                          setActiveVideoUrl(item.reference_video_url || null);
                          window.scrollTo({ top: 300, behavior: "smooth" });
                        }}
                        className="text-xs font-bold text-(--primary) hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="size-3 fill-current" /> Play in Theater
                      </button>
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold">Missing</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* 2. PUZZLE SIGN BREAKDOWN */}
          {game.game_type === "puzzle_sign" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {puzzleItems.map((item, idx) => (
                <article
                  key={idx}
                  className="rounded-3xl border-2 border-gray-200 bg-white p-5 shadow-sm space-y-4 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="size-8 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-400">
                      Puzzle {idx + 1} of {puzzleItems.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Formed Compound
                    </span>
                    <h3 className="heading-3 font-bold text-emerald-600">
                      {item.word_form}
                    </h3>
                  </div>

                  {/* Word Equation */}
                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Word 1</span>
                      <strong className="text-gray-800">{item.word_one}</strong>
                    </div>
                    <div className="text-gray-400 flex items-center justify-center font-bold">
                      +
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Word 2</span>
                      <strong className="text-gray-800">{item.word_two}</strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Target Hidden Word
                    </span>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 text-center">
                      {item.hidden_word}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Compound Image
                    </span>
                    <div className="aspect-video w-full rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {item.word_form_image_url ? (
                        <img
                          src={resolveMediaUrl(item.word_form_image_url)}
                          alt={item.word_form}
                          className="h-full w-full object-contain p-2"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.dataset.triedFallback && item.word_form_image_url) {
                              target.dataset.triedFallback = "true";
                              const filename = item.word_form_image_url.split("?")[0].split("/").pop();
                              target.src = `https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media/thumbnails/${filename}`;
                            } else {
                              target.style.display = "none";
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-400 text-xs">
                          <ImageIcon className="size-6" />
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Video Demo:</span>
                    {item.reference_video_url ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVideoRound(idx);
                          setActiveVideoUrl(item.reference_video_url || null);
                          window.scrollTo({ top: 300, behavior: "smooth" });
                        }}
                        className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="size-3 fill-current" /> Play in Theater
                      </button>
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold">Missing</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* 3. MAGIC FINGERS BREAKDOWN */}
          {game.game_type === "magic_fingers" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {magicItems.map((item, idx) => {
                const letters = (item.word || "").toUpperCase().split("");
                return (
                  <article
                    key={idx}
                    className="rounded-3xl border-2 border-gray-200 bg-white p-5 shadow-sm space-y-4 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="size-8 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-gray-400">
                        Round {idx + 1} of {magicItems.length}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Target Word
                      </span>
                      <h3 className="heading-3 font-bold text-purple-600">
                        {item.word}
                      </h3>
                    </div>

                    {/* Interactive Letters view */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Missing Letter Puzzle
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {letters.map((letter, lIdx) => {
                          const isHidden = (item.hidden_positions || []).includes(lIdx);
                          return (
                            <div
                              key={lIdx}
                              className={`size-10 rounded-xl font-bold flex items-center justify-center text-sm ${
                                isHidden
                                  ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-300"
                                  : "bg-gray-100 text-gray-800 border border-gray-200"
                              }`}
                            >
                              {isHidden ? "?" : letter}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Video Step 1:</span>
                        {item.reference_video_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveVideoRound(idx);
                              setActiveVideoUrl(item.reference_video_url || null);
                              window.scrollTo({ top: 300, behavior: "smooth" });
                            }}
                            className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="size-3 fill-current" /> Play Video 1
                          </button>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold">Missing</span>
                        )}
                      </div>

                      {item.reference_video_url_2 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Video Step 2:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveVideoRound(idx);
                              setActiveVideoUrl(item.reference_video_url_2 || null);
                              window.scrollTo({ top: 300, behavior: "smooth" });
                            }}
                            className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="size-3 fill-current" /> Play Video 2
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Edit Activity Dialog */}
      <EditMiniGameDialog
        isOpen={isEditOpen}
        miniGame={game}
        onClose={() => setIsEditOpen(false)}
        onUpdated={() => {
          loadGame();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteMiniGameDialog
        isOpen={isDeleteOpen}
        gameId={game.id}
        gameTitle={game.title}
        onClose={() => setIsDeleteOpen(false)}
        onDeleted={() => {
          navigate("/teacher/lessons");
        }}
      />
    </div>
  );
}
