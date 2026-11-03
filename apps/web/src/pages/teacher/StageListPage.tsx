import { useState } from "react";
import Button from "@/components/Button";
import Separator from "@/components/Separator";
import TopHeaderBar from "@/components/teacher/TopHeaderBar";
import EditStageDialog from "@/components/teacher/EditStageDialog";
import EditStageThumbnailsDialog from "@/components/teacher/EditStageThumbnailsDialog";
import { Image as ImageIcon } from "lucide-react";
import { useGetStages } from "@/hooks/useCurriculums";
import type { Stage } from "@/interfaces/curriculum.interface";
import { useNavigate, Link, useParams } from "react-router-dom";

export default function TeacherStageListPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const { stages, loading, error, refresh } = useGetStages(unitId ?? "");
  const navigate = useNavigate();

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading stages">
        <TopHeaderBar />
        <main className="p-6">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-(--gray-100)" />
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="min-h-52 animate-pulse rounded-2xl border border-(--border) bg-(--gray-100)"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <TopHeaderBar />

      <section className="p-6">
        <h1 className="heading-2 text-(--black)">Stages</h1>
        <Button
          type="button"
          className="mt-4 w-fit"
          onClick={() =>
            navigate("new", {
              state: {
                stageNumber: stages.length + 1,
              },
            })
          }
        >
          Add Stage
        </Button>

        <StageContent stages={stages} onRefresh={refresh} />
      </section>
    </div>
  );
}

function StageContent({ stages, onRefresh }: { stages: Stage[]; onRefresh: () => void }) {
  if (stages.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border-3 border-dashed border-(--border) bg-(--gray-50) px-6 py-12 text-center">
        <h2 className="heading-3 text-(--black)">No stages yet</h2>
        <p className="paragraph-2 mt-2 text-(--ghost)">
          Stages will appear here once they are added to this unit.
        </p>
      </div>
    );
  }

  // Sort stages by stage_number to ensure consistent progression order matching desktop
  const sortedStages = [...stages].sort((a, b) => (a.stage_number || 0) - (b.stage_number || 0));

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sortedStages.map((stage, index) => (
        <StageCard 
          key={stage.id} 
          stage={stage} 
          displayStageNumber={index + 1}
          onRefresh={onRefresh} 
        />
      ))}
    </div>
  );
}

function StageCard({ 
  stage, 
  displayStageNumber,
  onRefresh 
}: { 
  stage: Stage; 
  displayStageNumber: number;
  onRefresh: () => void;
}) {
  const [isThumbnailsModalOpen, setIsThumbnailsModalOpen] = useState(false);

  return (
    <>
      <article
        className={`flex min-h-52 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:border-(--primary) hover:shadow-lg ${
          stage.is_active
            ? "border-(--border) bg-(--white)"
            : "border-(--danger) bg-(--danger-light)"
        }`}
      >
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1 rounded-full bg-(--primary)" />
            <div>
              <p className="caption uppercase text-(--ghost)">
                Stage {displayStageNumber}
              </p>
              <h2 className="heading-3 text-(--black)">{stage.title}</h2>
            </div>
          </div>
          <EditStageDialog stage={stage} onUpdated={onRefresh} />
        </div>

        {stage.description && (
          <p className="paragraph-2 text-(--ghost)">{stage.description}</p>
        )}

        <div className="mt-auto space-y-4 pt-4">
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <Link to={`stages/${stage.id}`}>
              <Button className="w-fit">View Stage</Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsThumbnailsModalOpen(true)}
              className="text-xs px-3 py-2 gap-1.5 cursor-pointer bg-white text-gray-700 hover:text-(--primary) border-gray-200 hover:bg-amber-50"
              title="Edit visual aid thumbnails for Lesson Proper"
            >
              <ImageIcon className="size-3.5 text-amber-500" />
              <span>Thumbnails</span>
            </Button>
          </div>
        </div>
      </article>

      <EditStageThumbnailsDialog
        isOpen={isThumbnailsModalOpen}
        onClose={() => setIsThumbnailsModalOpen(false)}
        stageId={stage.id}
        stageTitle={stage.title}
        stageNumber={displayStageNumber}
        onUpdated={onRefresh}
      />
    </>
  );
}
