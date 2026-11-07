import TopHeaderBar from "@/components/parent/TopHeaderBar";
import { useParentDashboard } from "@/hooks/useParentDashboard";

export default function ParentProgressPage() {
  const {
    parameterMastery,
    performanceTrend,
    selectedWeekIndex,
    setSelectedWeekIndex,
    loading,
    error,
    selectedChild,
  } = useParentDashboard();

  const selectedWeek = selectedWeekIndex !== null
    ? performanceTrend.find((item) => item.weekIndex === selectedWeekIndex)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopHeaderBar />
        <div className="p-8 flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3">
            <div className="size-10 border-4 border-[#FF8A00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-500">Loading progress analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !selectedChild) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopHeaderBar />
        <div className="p-8 max-w-4xl mx-auto w-full">
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-800">No Student Linked</h2>
            <p className="text-sm text-gray-500 mt-2">
              Please link a student to your account to view detailed signing parameter mastery.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <TopHeaderBar />

      <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
        {/* Section 1: Parameter Mastery (Interactive with Weekly Trend) */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Parameter Mastery
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedWeek
                  ? `Showing parameter mastery for ${selectedWeek.label} (${selectedWeek.dateRange || "Selected Week"})`
                  : "Showing cumulative all-time parameter mastery across mastered signs"}
              </p>
            </div>
            {selectedWeek && (
              <button
                type="button"
                onClick={() => setSelectedWeekIndex(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer shadow-xs"
              >
                <span>Reset to All-Time Mastery</span>
                <span className="font-extrabold text-sm leading-none">&times;</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-gray-100 shadow-sm space-y-6">
            {parameterMastery.map((param) => (
              <div key={param.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800 tracking-wide">
                    {param.name}
                  </span>
                  <span className="px-3.5 py-0.5 rounded-full bg-[#FF8A00] text-white text-xs font-bold shadow-xs">
                    {param.value}%
                  </span>
                </div>

                {/* Orange Horizontal Progress Bar */}
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF8A00] rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, param.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Performance Trend (Incrementing Weeks & Interactive Selection) */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Performance Trend
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Click any active week bar to filter parameter mastery specifically for that week.
              </p>
            </div>
            {selectedWeekIndex !== null && (
              <span className="px-3 py-1 rounded-full bg-[#FF8A00] text-white text-xs font-bold shadow-xs">
                {selectedWeek?.label} Active
              </span>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm overflow-hidden">
            {/* Chart Area with Horizontal Scroll for Incrementing Weeks */}
            {performanceTrend.length > 0 ? (
              <div className="overflow-x-auto pb-2">
                <div className="h-72 flex items-end justify-center gap-2 sm:gap-4 px-2 pt-8 pb-4 min-w-[500px]">
                  {performanceTrend.map((item) => {
                    const isSelected = selectedWeekIndex === item.weekIndex;
                    const isClickable = !item.isUpcoming && (item.attemptsCount ? item.attemptsCount > 0 : item.score > 0);

                    return (
                      <div
                        key={item.label}
                        className="flex-1 flex flex-col items-center justify-end h-full max-w-xs min-w-[70px]"
                      >
                        {/* Stepped Bar Button */}
                        <button
                          type="button"
                          disabled={!isClickable}
                          onClick={() => {
                            if (isClickable) {
                              setSelectedWeekIndex(isSelected ? null : (item.weekIndex ?? null));
                            }
                          }}
                          className={`w-full rounded-t-2xl transition-all duration-300 flex items-center justify-center ${
                            isClickable ? "cursor-pointer" : "cursor-default"
                          } ${
                            isSelected
                              ? "bg-[#FF8A00] shadow-xl ring-4 ring-orange-300 border-2 border-orange-700 scale-[1.03] text-white"
                              : item.isCurrent
                              ? "bg-[#FF8A00] shadow-md border-b-4 border-amber-800 text-white hover:scale-[1.02]"
                              : item.isUpcoming
                              ? "bg-gray-100 border-2 border-dashed border-gray-200 text-gray-400"
                              : "bg-[#FBBF24]/75 hover:bg-[#FBBF24] hover:scale-[1.02] text-gray-800"
                          }`}
                          style={{
                            height: item.isUpcoming
                              ? "20%"
                              : `${Math.min(100, Math.max(15, item.score))}%`,
                          }}
                          title={
                            item.isUpcoming
                              ? "Upcoming week - no practice sessions recorded yet"
                              : `Click to view ${item.label} (${item.dateRange || ""}) parameter mastery`
                          }
                        >
                          {item.isCurrent || isSelected ? (
                            <span className="text-white font-extrabold text-sm sm:text-base drop-shadow-xs">
                              {item.score}%
                            </span>
                          ) : !item.isUpcoming ? (
                            <span className="text-gray-700 font-extrabold text-xs sm:text-sm">
                              {item.score}%
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-gray-400">
                              Upcoming
                            </span>
                          )}
                        </button>

                        {/* X-axis Label below bar */}
                        <div className="mt-3 flex flex-col items-center">
                          <span
                            className={`text-xs sm:text-sm font-semibold tracking-wide ${
                              isSelected || item.isCurrent
                                ? "text-[#FF8A00] font-extrabold"
                                : item.isUpcoming
                                ? "text-gray-400"
                                : "text-gray-700 font-bold"
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.dateRange && (
                            <span className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                              {item.dateRange}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center p-8 text-center">
                <div className="size-14 rounded-full bg-orange-50 text-[#FF8A00] flex items-center justify-center mb-3">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-base font-bold text-gray-800">
                  No Practice Sessions Recorded Yet
                </h3>
                <p className="text-sm text-gray-400 max-w-md mt-1">
                  Once {selectedChild.name} practices signs and completes evaluations on the student desktop app, their accuracy trends across sessions will be charted here.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
