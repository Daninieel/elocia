import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/Button";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  ImagePlus,
  Plus,
  Save,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import StepIndicator from "../../../components/StepIndicator";
import Separator from "../../../components/Separator";
import Input from "../../../components/Input";
import Dropdown from "../../../components/Dropdown";
import { useState, type FormEvent } from "react";
import { createMiniGame, uploadMiniGameMedia, resolveMediaUrl } from "@/services/mini-games";

const steps = [
  {
    number: 1,
    label: "Basic Info",
  },
  {
    number: 2,
    label: "Add Content",
  },
  {
    number: 3,
    label: "Preview & Publish",
  },
];

const DRAFT_KEY = "teacher-see-it-sign-it-draft";

type SeeItSignItGameItem = {
  objective_image_url: string;
  objective_answer: string;
  reference_video_url?: string;
  index_order: number;
};

type SeeItSignItGamePayload = {
  game_type: "see_it_sign_it";
  title: string;
  description: string;
  difficulty: number;
  items: SeeItSignItGameItem[];
};

const initialGame: SeeItSignItGamePayload = {
  game_type: "see_it_sign_it",
  title: "",
  description: "",
  difficulty: 1,
  items: [
    {
      objective_image_url: "",
      objective_answer: "",
      reference_video_url: "",
      index_order: 0,
    },
  ],
};

function readDraft(): SeeItSignItGamePayload {
  const draft = sessionStorage.getItem(DRAFT_KEY);
  return draft ? { ...initialGame, ...JSON.parse(draft) } : initialGame;
}

export function SeeItSignItCreateActivityStepOnePage() {
  const [game, setGame] = useState(readDraft);
  const saveDraft = () =>
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(game));

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={1} />

      <article className="flex flex-col p-6 gap-6 bg-(--white) rounded-4xl shadow-lg/5">
        <div className="space-y-4">
          <h1 className="heading-3">Let's start with the basics</h1>
          <div>
            <label htmlFor="activity-title">Activity Title</label>
            <Input
              type="text"
              id="activity-title"
              placeholder="Enter activity title"
              value={game.title}
              onChange={(event) =>
                setGame({ ...game, title: event.target.value })
              }
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="Enter a brief description of the activity"
              value={game.description}
              onChange={(event) =>
                setGame({ ...game, description: event.target.value })
              }
              className="resize-none p-4 w-full rounded-md border-2 border-(--border) bg-(--gray-50) paragraph-2 text-(--ghost) outline-none"
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="difficulty">Difficulty</label>
          <Dropdown
            value={String(game.difficulty)}
            onChange={(value) =>
              setGame({ ...game, difficulty: Number(value) })
            }
            className=""
            options={[
              { label: "Easy", value: "1" },
              { label: "Medium", value: "2" },
              { label: "Hard", value: "3" },
            ]}
          />
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <Link to="/teacher/tasks">
            <Button variant="destructive">
              Cancel <X />
            </Button>
          </Link>
          <Link to="../step-2" onClick={saveDraft}>
            <Button className="gap-2">
              Next Step
              <ChevronRight className="size-5" />
            </Button>
          </Link>
        </div>
      </article>
    </section>
  );
}

export function SeeItSignItCreateActivityStepTwoPage() {
  const [game, setGame] = useState<SeeItSignItGamePayload>(readDraft);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  const saveDraft = () =>
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(game));

  const updateItem = (index: number, update: Partial<SeeItSignItGameItem>) => {
    setGame((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    }));
  };

  const handleMediaFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: "objective_image_url" | "reference_video_url",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadingTarget(`${index}_${field}`);
    setUploadProgress(0);
    setUploadError("");
    try {
      const res = await uploadMiniGameMedia(file, (percent) => {
        setUploadProgress(percent);
      });
      updateItem(index, { [field]: res.url });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload media",
      );
    } finally {
      setIsUploading(false);
      setUploadingTarget(null);
      setUploadProgress(0);
    }
  };

  const addRound = () =>
    setGame((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          objective_image_url: "",
          objective_answer: "",
          reference_video_url: "",
          index_order: prev.items.length,
        },
      ],
    }));

  const duplicateRound = (index: number) => {
    setGame((prev) => {
      const source = prev.items[index];
      const cloned: SeeItSignItGameItem = {
        ...source,
        index_order: index + 1,
      };
      const updated = [...prev.items];
      updated.splice(index + 1, 0, cloned);
      return {
        ...prev,
        items: updated.map((item, idx) => ({ ...item, index_order: idx })),
      };
    });
  };

  const moveRound = (index: number, direction: "up" | "down") => {
    setGame((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.items.length) return prev;
      const updated = [...prev.items];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return {
        ...prev,
        items: updated.map((item, idx) => ({ ...item, index_order: idx })),
      };
    });
  };

  const deleteRound = (index: number) =>
    setGame((prev) => ({
      ...prev,
      items: prev.items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, index_order: itemIndex })),
    }));

  const handleBatchVideoDrop = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError("");
    setBatchProgress(`Uploading 1 of ${files.length} (0%)...`);
    try {
      const newItems: SeeItSignItGameItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .trim();
        const capitalized = cleanName
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");

        let uploadedUrl = "";
        try {
          const res = await uploadMiniGameMedia(file, (percent) => {
            setBatchProgress(`Uploading video ${i + 1} of ${files.length} (${percent}%)...`);
          });
          uploadedUrl = res.url;
        } catch (uploadErr) {
          console.error("Batch upload failed for file:", file.name, uploadErr);
        }

        newItems.push({
          objective_image_url: "",
          objective_answer: capitalized || "Sign",
          reference_video_url: uploadedUrl,
          index_order: game.items.length + i,
        });
      }

      setGame((prev) => {
        const hasOnlyEmptyFirst =
          prev.items.length === 1 && !prev.items[0].objective_answer && !prev.items[0].reference_video_url;
        const baseItems = hasOnlyEmptyFirst ? [] : prev.items;
        return {
          ...prev,
          items: [...baseItems, ...newItems].map((item, idx) => ({
            ...item,
            index_order: idx,
          })),
        };
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Batch upload failed");
    } finally {
      setIsUploading(false);
      setBatchProgress(null);
    }
  };

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={2} />

      {uploadError && (
        <div className="p-4 bg-red-100 text-red-700 rounded-xl text-sm">
          {uploadError}
        </div>
      )}

      {/* Batch Video Dropzone */}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--primary) bg-(--primary-light)/40 p-6 text-center transition-colors hover:bg-(--primary-light)">
        <UploadCloud className="size-8 text-(--primary)" />
        <span className="paragraph-2 font-semibold text-(--primary)">
          {batchProgress ? `⚡ ${batchProgress}` : "⚡ Batch Upload Videos (Auto-Generates Rounds)"}
        </span>
        <span className="caption text-(--ghost)">
          Drop multiple .mp4 / .webm videos — target signs will be auto-named from filenames!
        </span>
        <input
          type="file"
          multiple
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          className="sr-only"
          disabled={isUploading}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            handleBatchVideoDrop(files);
            e.target.value = "";
          }}
        />
      </label>

      {game.items.map((item, index) => (
        <article
          key={item.index_order ?? index}
          className="flex flex-col gap-6 p-6 bg-(--white) rounded-4xl shadow-lg/5"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-white">
                {index + 1}
              </span>
              <Flag className="size-5" />
              <h1 className="heading-3">Round {index + 1}</h1>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Move Up */}
              <Button
                type="button"
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={index === 0}
                onClick={() => moveRound(index, "up")}
                title="Move round up"
              >
                <ArrowUp className="size-4" />
              </Button>

              {/* Move Down */}
              <Button
                type="button"
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={index === game.items.length - 1}
                onClick={() => moveRound(index, "down")}
                title="Move round down"
              >
                <ArrowDown className="size-4" />
              </Button>

              {/* Duplicate Round */}
              <Button
                type="button"
                variant="outline"
                className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => duplicateRound(index)}
                title="Duplicate round"
              >
                <Copy className="size-4" />
              </Button>

              {/* Remove */}
              {game.items.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => deleteRound(index)}
                  title="Delete round"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div>
                <span>Objective Image</span>
                <label className="flex flex-col min-h-56 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-6 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light)">
                  {item.objective_image_url ? (
                    <img
                      src={resolveMediaUrl(item.objective_image_url)}
                      alt="Uploaded objective"
                      className="max-h-40 max-w-full rounded-xl object-contain"
                    />
                  ) : (
                    <>
                      <ImagePlus className="size-10 text-(--primary)" />
                      <span className="paragraph-2 font-semibold text-(--black)">
                        {isUploading && uploadingTarget === `${index}_objective_image_url`
                          ? `Uploading image (${uploadProgress}%)...`
                          : isUploading
                          ? "Uploading..."
                          : "Click to upload an image"}
                      </span>
                      {isUploading && uploadingTarget === `${index}_objective_image_url` && (
                        <div className="w-full max-w-[200px] bg-gray-200 h-2 rounded-full overflow-hidden my-1">
                          <div
                            className="bg-(--primary) h-full transition-all duration-150 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                      <span className="caption text-(--ghost)">
                        PNG or JPG up to 10MB
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      handleMediaFileChange(event, index, "objective_image_url")
                    }
                    disabled={isUploading}
                    className="sr-only"
                  />
                </label>
              </div>
              <div>
                <label htmlFor="target-sign">Target Sign</label>
                <Input
                  type="text"
                  placeholder="Enter the target sign"
                  value={item.objective_answer}
                  onChange={(event) =>
                    updateItem(index, { objective_answer: event.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div>
              <div>
                <label>Reference Video</label>
                <label className="flex flex-col min-h-56 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-(--border) bg-(--gray-50) p-6 text-center transition-colors hover:border-(--primary) hover:bg-(--primary-light)">
                  {item.reference_video_url ? (
                    <video
                      src={resolveMediaUrl(item.reference_video_url)}
                      controls
                      className="max-h-40 max-w-full rounded-xl"
                    />
                  ) : (
                    <>
                      <Upload className="size-10 text-(--primary)" />
                      <span className="paragraph-2 font-semibold text-(--black)">
                        {isUploading && uploadingTarget === `${index}_reference_video_url`
                          ? `Uploading video (${uploadProgress}%)...`
                          : isUploading
                          ? "Uploading..."
                          : "Click to upload a video"}
                      </span>
                      {isUploading && uploadingTarget === `${index}_reference_video_url` && (
                        <div className="w-full max-w-[200px] bg-gray-200 h-2 rounded-full overflow-hidden my-1">
                          <div
                            className="bg-(--primary) h-full transition-all duration-150 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                      <span className="caption text-(--ghost)">
                        MP4, WebM, or MOV up to 100MB
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(event) =>
                      handleMediaFileChange(event, index, "reference_video_url")
                    }
                    disabled={isUploading}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>
          {uploadError && <p className="text-red-500 text-sm">{uploadError}</p>}
        </article>
      ))}

      <button
        type="button"
        onClick={addRound}
        className="w-full flex flex-col bg-white border-2 border-dashed border-(--border) rounded-2xl p-6 items-center justify-center gap-2 transition-colors hover:border-(--primary) hover:bg-(--primary-light)"
      >
        <div className="w-fit rounded-full bg-(--primary) p-2 text-(--white)">
          <Plus className="size-4" />
        </div>
        <span className="paragraph-2 font-semibold text-(--primary)">
          Add another round
        </span>
      </button>

      <Separator />

      <div className="flex items-center justify-between">
        <Link to="../step-1">
          <Button>
            <ChevronLeft className="size-5" />
            Back
          </Button>
        </Link>
        <Link to="../step-3" onClick={saveDraft}>
          <Button className="gap-2">
            Next Step
            <ChevronRight className="size-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function SeeItSignItCreateActivityStepThreePage() {
  const [game] = useState(readDraft);
  const [error, setError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const navigate = useNavigate();

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = (game.title || "").trim();
    const targetSign = (game.items[0]?.objective_answer || "").trim();
    if (!title || !targetSign) {
      setError("Title and target sign are required.");
      return;
    }
    if (game.items.some((item) => !item.objective_answer.trim())) {
      setError("Enter an answer for every round.");
      return;
    }

    setIsPublishing(true);
    setError("");
    try {
      await createMiniGame({
        game_type: game.game_type,
        title,
        description: game.description.trim(),
        difficulty: game.difficulty || 1,
        target_sign: targetSign,
        prompt_image: game.items[0]?.objective_image_url || "",
        reference_video_url: game.items[0]?.reference_video_url || "",
        see_it_sign_it_items: [
          ...game.items.map((item, index) => ({
            objective_image_url: item.objective_image_url,
            objective_answer: item.objective_answer.trim(),
            reference_video_url: item.reference_video_url,
            index_order: index,
          })),
        ],
      });
      sessionStorage.removeItem(DRAFT_KEY);
      navigate("/teacher/tasks");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Failed to publish mini-game",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="space-y-6 mt-6">
      <StepIndicator steps={steps} step={3} />

      <article className="space-y-6 rounded-4xl border-2 border-dashed border-(--primary) bg-(--white) p-6 shadow-lg/5">
        <header className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <p className="caption font-semibold uppercase tracking-wide text-(--primary)">
              See It, Sign It activity
            </p>
            <h1 className="heading-2 text-(--black)">
              {game.title || "Untitled activity"}
            </h1>
            <p className="paragraph-2 whitespace-pre-wrap text-(--ghost)">
              {game.description || "No description provided."}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:min-w-56 md:grid-cols-1">
            <div className="rounded-2xl bg-(--gray-50) p-4">
              <dt className="caption text-(--black)/50">Difficulty</dt>
              <dd className="paragraph-1 font-semibold text-(--black)">
                {game.difficulty === 1
                  ? "Easy"
                  : game.difficulty === 2
                    ? "Medium"
                    : "Hard"}
              </dd>
            </div>
            <div className="rounded-2xl bg-(--gray-50) p-4">
              <dt className="caption text-(--black)/50">Rounds</dt>
              <dd className="paragraph-1 font-semibold text-(--black)">
                {game.items.length}
              </dd>
            </div>
          </dl>
        </header>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-3">Round preview</h2>
            <span className="caption text-(--ghost)">
              {game.items.length} {game.items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="space-y-4">
            {game.items.map((item, index) => (
              <article
                key={`${item.index_order}-${index}`}
                className="grid gap-5 rounded-2xl border-2 border-(--border) bg-(--gray-50) p-5 lg:grid-cols-2"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-(--primary) font-semibold text-(--white)">
                      {index + 1}
                    </span>
                    <h3 className="heading-4">Round {index + 1}</h3>
                  </div>
                  <div className="rounded-xl bg-(--white) p-4">
                    <p className="caption text-(--black)/50">Target sign</p>
                    <p className="paragraph-1 font-semibold text-(--primary)">
                      {item.objective_answer || "No target sign entered"}
                    </p>
                  </div>
                  {item.objective_image_url ? (
                    <img
                      src={resolveMediaUrl(item.objective_image_url)}
                      alt={`Round ${index + 1} objective`}
                      className="max-h-52 w-full rounded-xl object-contain"
                    />
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-(--border) bg-(--white) p-6 text-center">
                      <p className="caption text-(--ghost)">
                        No objective image uploaded.
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="paragraph-2 font-semibold text-(--black)">
                    Reference video
                  </p>
                  {item.reference_video_url ? (
                    <video
                      src={resolveMediaUrl(item.reference_video_url)}
                      controls
                      className="max-h-64 w-full rounded-xl bg-black"
                    />
                  ) : (
                    <div className="flex min-h-40 items-center justify-center rounded-xl border-2 border-dashed border-(--border) bg-(--white) p-6 text-center">
                      <p className="caption text-(--danger)">
                        No reference video uploaded.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </article>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Link to="../step-2">
            <Button>
              <ChevronLeft className="size-5" />
              Back
            </Button>
          </Link>
          <Button variant="destructive">
            Cancel <X />
          </Button>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" className="gap-2">
            Save as Draft <Save className="size-4" />
          </Button>
          <form onSubmit={handlePublish}>
            <Button className="gap-2" type="submit" disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish"}{" "}
              <Upload className="size-4" />
            </Button>
          </form>
        </div>
        {error && (
          <p className="paragraph-2 text-(--danger)" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
