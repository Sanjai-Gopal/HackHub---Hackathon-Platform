import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import Script from "next/script";
import { useAppContext } from "../context/AppContext";
import { useRouter } from "next/router";
import {
  Users,
  CheckSquare,
  Plus,
  ArrowRight,
  Sparkles,
  Calendar,
  Clock,
  Layers,
} from "lucide-react";

interface ChartInstance {
  destroy: () => void;
}

interface ChartTooltipContext {
  label?: string;
  parsed: number | null;
}

interface ChartConstructor {
  new (ctx: CanvasRenderingContext2D, config: unknown): ChartInstance;
  getChart: (canvas: HTMLCanvasElement) => ChartInstance | undefined;
}

// Add Chart.js type to Window interface
declare global {
  interface Window {
    Chart?: ChartConstructor;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const {
    tasks,
    teamName,
    teamBio,
    teamMembers,
    currentUser,
    isAuthenticated,
    deadline,
    hackathonEndTime,
  } = useAppContext();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartJsLoaded, setChartJsLoaded] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [hackathonTimeRemaining, setHackathonTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Calculate task statistics - memoized to prevent unnecessary recalculations
  const taskStats = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "Done").length;
    const inProgressTasks = tasks.filter(
      (t) => t.status === "In Progress"
    ).length;
    const todoTasks = tasks.filter((t) => t.status === "To Do").length;
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      completionPercentage,
      chartData: [completedTasks, inProgressTasks, todoTasks],
    };
  }, [tasks]);

  const upcomingTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Done"),
    [tasks]
  );

  // Simplified chart initialization function
  const initializeChart = useCallback(() => {
    if (!chartRef.current || !window.Chart) {
      return;
    }

    try {
      setChartLoading(true);
      setChartError(null);

      const ctx = chartRef.current.getContext("2d");
      if (!ctx) {
        setChartError("Could not get canvas context");
        setChartLoading(false);
        return;
      }

      // Check for existing chart instance and destroy it
      const existingChart = window.Chart.getChart(chartRef.current);
      if (existingChart) {
        existingChart.destroy();
      }

      // Don't render empty chart if no tasks exist
      if (taskStats.totalTasks === 0) {
        setChartLoading(false);
        return;
      }

      // Create new chart
      new window.Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Done", "In Progress", "To Do"],
          datasets: [
            {
              data: taskStats.chartData,
              backgroundColor: [
                "#10b981", // emerald-500
                "#f59e0b", // amber-500
                "#f43f5e", // rose-500
              ],
              borderColor: "#18181b", // zinc-900
              borderWidth: 4,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          animation: {
            duration: 500,
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#f8fafc",
                font: { size: 13, weight: 600 },
              },
            },
            tooltip: {
              callbacks: {
                label: function (context: ChartTooltipContext) {
                  let label = context.label || "";
                  if (label) label += ": ";
                  if (context.parsed !== null)
                    label += context.parsed + " tasks";
                  return label;
                },
              },
            },
          },
        },
      });

      setChartError(null);
      setChartLoading(false);
    } catch (error) {
      setChartError(
        `Error creating chart: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setChartLoading(false);
    }
  }, [taskStats]);

  // Set isClient to true when component mounts (client-side only)
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined" && window.Chart) {
      setChartJsLoaded(true);
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Calculate time remaining until deadline
  useEffect(() => {
    if (!deadline) {
      setTimeRemaining("Deadline not set");
      return;
    }

    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const distance = deadline.getTime() - now;

      if (distance < 0) {
        setTimeRemaining("Expired");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      return `${days} days, ${hours} hours, ${minutes} minutes remaining`;
    };

    setTimeRemaining(calculateTimeRemaining());

    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 60000);

    return () => clearInterval(timer);
  }, [deadline]);

  // Hackathon countdown timer using context
  useEffect(() => {
    if (!hackathonEndTime) return;

    const calculateHackathonTime = () => {
      const now = new Date().getTime();
      const distance = hackathonEndTime.getTime() - now;

      if (distance < 0) {
        setHackathonTimeRemaining(null);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setHackathonTimeRemaining({ days, hours, minutes, seconds });
    };

    calculateHackathonTime();

    const timer = setInterval(calculateHackathonTime, 1000);

    return () => clearInterval(timer);
  }, [hackathonEndTime]);

  // Calculate hackathon progress percentage
  const getHackathonProgress = () => {
    if (!hackathonEndTime || !hackathonTimeRemaining) return 0;

    const totalDuration = 48 * 60 * 60 * 1000;
    const remainingTime =
      hackathonTimeRemaining.days * 24 * 60 * 60 * 1000 +
      hackathonTimeRemaining.hours * 60 * 60 * 1000 +
      hackathonTimeRemaining.minutes * 60 * 1000 +
      hackathonTimeRemaining.seconds * 1000;

    const elapsed = totalDuration - remainingTime;
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  };

  // Main chart initialization effect
  useEffect(() => {
    if (!isClient || !chartJsLoaded || !window.Chart || !chartRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      initializeChart();
    }, 200);

    return () => clearTimeout(timer);
  }, [isClient, chartJsLoaded, initializeChart, taskStats.totalTasks]);

  // Route change handler for dashboard
  useEffect(() => {
    if (router.pathname === "/dashboard" && chartJsLoaded && window.Chart) {
      const timers = [
        setTimeout(() => initializeChart(), 100),
        setTimeout(() => {
          if (chartRef.current && !window.Chart?.getChart(chartRef.current)) {
            initializeChart();
          }
        }, 500),
      ];

      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    }
  }, [router.pathname, chartJsLoaded, initializeChart]);

  // Periodic chart health check
  useEffect(() => {
    if (
      router.pathname === "/dashboard" &&
      chartJsLoaded &&
      window.Chart &&
      taskStats.totalTasks > 0
    ) {
      const healthCheck = setInterval(() => {
        if (chartRef.current && !window.Chart?.getChart(chartRef.current)) {
          initializeChart();
        }
      }, 3000);

      return () => clearInterval(healthCheck);
    }
  }, [router.pathname, chartJsLoaded, initializeChart, taskStats.totalTasks]);

  // Cleanup function on unmount
  useEffect(() => {
    return () => {
      try {
        if (chartRef.current && window.Chart) {
          const existingChart = window.Chart.getChart(chartRef.current);
          if (existingChart) {
            existingChart.destroy();
          }
        }
      } catch (e) {
        console.error("Error cleaning up chart:", e);
      }
    };
  }, []);

  const teamInitial = teamName ? teamName.charAt(0) : "T";
  const hasTeam = Boolean(teamName && teamName !== "My Team");

  if (isLoading) {
    return (
      <div className="min-h-screen dark-theme-background flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>HackHub - Dashboard</title>
      </Head>
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"
        strategy="afterInteractive"
        onLoad={() => {
          setChartJsLoaded(true);
          setTimeout(() => {
            if (chartRef.current && window.Chart) {
              initializeChart();
            }
          }, 100);
        }}
        onError={(e) => {
          console.error("Failed to load Chart.js", e);
          setChartError("Failed to load Chart.js");
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display text-gradient-primary text-glow">
            Team Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Overview of team progress, active deliverables, and hackathon milestones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/tasks")}
            className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Empty State Banner: User has not joined or created a team */}
      {!hasTeam && (
        <div className="mb-6 p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-zinc-900/60 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                You have not joined a hackathon team yet
              </h4>
              <p className="text-xs text-zinc-300 mt-0.5 max-w-2xl">
                Collaborating is faster together! Join an existing squad with an invite code or create a team to unlock team-isolated tasks, real-time chat, and shared file uploads.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => router.push("/team-setup")}
              className="btn-primary text-xs px-4 py-2 w-full sm:w-auto whitespace-nowrap"
            >
              Set Up Team →
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Progress Chart, Team Profile, Deadline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Progress Chart */}
        <div className="card lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base sm:text-lg font-heading font-semibold text-white">
                Project Progress
              </h3>
              <button
                onClick={() => {
                  setChartError(null);
                  setChartLoading(true);
                  if (chartRef.current && window.Chart) {
                    const existingChart = window.Chart.getChart(chartRef.current);
                    if (existingChart) {
                      existingChart.destroy();
                    }
                  }
                  setTimeout(initializeChart, 100);
                }}
                className="btn-secondary text-xs px-2.5 py-1"
                title="Refresh Chart"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs sm:text-sm text-zinc-400">
                Visual breakdown of completed vs in-progress tasks.
              </p>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-display text-gradient-primary font-bold">
                  {taskStats.completionPercentage}%
                </p>
                <p className="text-[11px] text-zinc-400">Tasks Completed</p>
              </div>
            </div>

            {/* Glass Chart Container */}
            <div className="chart-enhanced relative h-60 sm:h-64 p-4 flex items-center justify-center">
              {/* Empty State when no tasks exist */}
              {taskStats.totalTasks === 0 && !chartLoading && !chartError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/85 backdrop-blur-sm rounded-lg p-4 text-center z-10">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-2">
                    <CheckSquare className="w-6 h-6 text-cyan-400" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    No tasks created yet
                  </p>
                  <p className="text-xs text-zinc-400 max-w-xs mb-3">
                    Start tracking deliverables and assign work items to team members.
                  </p>
                  <button
                    onClick={() => router.push("/tasks")}
                    className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Task
                  </button>
                </div>
              )}

              {chartError && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 bg-opacity-90 rounded-lg z-10">
                  <div className="text-center p-4">
                    <p className="text-rose-400 text-xs sm:text-sm mb-2">{chartError}</p>
                    <button
                      onClick={() => {
                        setChartError(null);
                        setChartLoading(true);
                        initializeChart();
                      }}
                      className="btn-primary text-xs px-3 py-1"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {(!chartJsLoaded || chartLoading) && !chartError && taskStats.totalTasks > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 bg-opacity-50 rounded-lg z-10">
                  <div className="text-center">
                    <div className="loader mb-2"></div>
                    <p className="text-zinc-400 text-xs">
                      {!chartJsLoaded ? "Loading Chart.js..." : "Initializing chart..."}
                    </p>
                  </div>
                </div>
              )}

              <canvas
                ref={chartRef}
                id="progressChart"
                className="w-full h-full"
              ></canvas>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
            <div className="text-center p-2.5 sm:p-3 glass rounded-xl">
              <p className="text-xs sm:text-sm text-emerald-400 font-semibold">Done</p>
              <p className="text-lg sm:text-2xl font-bold text-emerald-300">
                {taskStats.completedTasks}
              </p>
            </div>
            <div className="text-center p-2.5 sm:p-3 glass rounded-xl">
              <p className="text-xs sm:text-sm text-amber-400 font-semibold">In Progress</p>
              <p className="text-lg sm:text-2xl font-bold text-amber-300">
                {taskStats.inProgressTasks}
              </p>
            </div>
            <div className="text-center p-2.5 sm:p-3 glass rounded-xl">
              <p className="text-xs sm:text-sm text-rose-400 font-semibold">To Do</p>
              <p className="text-lg sm:text-2xl font-bold text-rose-300">
                {taskStats.todoTasks}
              </p>
            </div>
          </div>
        </div>

        {/* Team Profile Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-heading font-semibold text-white mb-4 truncate">
              {teamName || "My Team"}
            </h3>

            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 border-2 border-zinc-700
                         flex items-center justify-center 
                         bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-inner"
            >
              <span className="text-3xl sm:text-4xl font-display text-gradient-primary font-bold">
                {teamInitial}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 text-center line-clamp-3">
              {teamBio || "No bio added yet. Describe your hackathon project and mission."}
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <button
              onClick={() => router.push("/team-setup")}
              className="w-full btn-secondary text-xs py-2"
            >
              {hasTeam ? "Edit Team Profile" : "Configure Team"}
            </button>
          </div>
        </div>

        {/* Hackathon Timer Card */}
        <div className="vibrant-card glow-purple flex flex-col justify-between">
          <div>
            <div className="text-center">
              <h3 className="text-base sm:text-lg font-heading font-semibold mb-1 text-white">
                Project Deadline
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-300 mb-4">
                Time remaining until project submission
              </p>

              {hackathonTimeRemaining ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="timer-digit-enhanced glow-purple p-2 sm:p-3">
                      <div className="text-lg sm:text-2xl font-display text-white tabular-nums font-bold">
                        {hackathonTimeRemaining.days.toString().padStart(2, "0")}
                      </div>
                      <div className="text-[10px] text-gray-200">DAYS</div>
                    </div>
                    <div className="timer-digit-enhanced glow-pink p-2 sm:p-3">
                      <div className="text-lg sm:text-2xl font-display text-white tabular-nums font-bold">
                        {hackathonTimeRemaining.hours.toString().padStart(2, "0")}
                      </div>
                      <div className="text-[10px] text-gray-200">HOURS</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="timer-digit-enhanced glow-orange p-2 sm:p-3">
                      <div className="text-lg sm:text-2xl font-display text-white tabular-nums font-bold">
                        {hackathonTimeRemaining.minutes.toString().padStart(2, "0")}
                      </div>
                      <div className="text-[10px] text-gray-200">MINS</div>
                    </div>
                    <div className="timer-digit-enhanced glow-purple p-2 sm:p-3">
                      <div className="text-lg sm:text-2xl font-display text-white tabular-nums font-bold">
                        {hackathonTimeRemaining.seconds.toString().padStart(2, "0")}
                      </div>
                      <div className="text-[10px] text-gray-200">SECS</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] text-gray-200 mb-1.5">
                      <span>Start</span>
                      <span>Finish</span>
                    </div>
                    <div className="w-full bg-zinc-700/80 rounded-full h-2">
                      <div
                        className="progress-enhanced h-2 rounded-full transition-all duration-1000"
                        style={{
                          width: `${getHackathonProgress()}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-center mt-1.5">
                      <span className="text-[11px] text-gray-200 font-medium">
                        {Math.round(getHackathonProgress())}% Elapsed
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 timer-complete">
                  <div className="text-3xl mb-1">🎉</div>
                  <p className="text-sm font-heading text-white font-semibold">
                    Deadline Reached!
                  </p>
                  <p className="text-xs text-gray-200 mt-1">
                    Ready to submit your project
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-purple-500/20">
            <button
              onClick={() => router.push("/team-setup")}
              className="btn-secondary w-full text-xs py-1.5"
            >
              Extend / Adjust Deadline
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Tasks Section */}
      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-white">Upcoming Tasks</h3>
            <p className="text-xs text-zinc-400">Tasks in progress or pending completion.</p>
          </div>
          <button
            onClick={() => router.push("/tasks")}
            className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-medium"
          >
            View Board <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-8 glass rounded-xl border border-dashed border-zinc-700/60">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-white">No tasks created yet</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto mb-4">
              Break down your hackathon project into actionable items and assign them to your teammates.
            </p>
            <button
              onClick={() => router.push("/tasks")}
              className="btn-primary text-xs px-4 py-2"
            >
              + Create First Task
            </button>
          </div>
        ) : upcomingTasks.length > 0 ? (
          <div className="space-y-3">
            {upcomingTasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 sm:p-4 glass rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 transition-all duration-300 hover:border-zinc-700"
              >
                <div>
                  <p className="font-medium text-sm sm:text-base text-white">{task.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Assigned to: <span className="text-zinc-300">{task.assignee}</span>
                  </p>
                </div>
                <span
                  className={`status-badge shrink-0 self-start sm:self-auto text-xs ${
                    task.status === "In Progress"
                      ? "status-progress"
                      : "status-todo"
                  }`}
                >
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 glass rounded-xl">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-sm font-medium text-emerald-400">All tasks completed!</p>
            <p className="text-xs text-zinc-400 mt-1">
              Outstanding work! All sprint tasks have been moved to Done.
            </p>
          </div>
        )}
      </div>

      {/* Team Members Section */}
      <div className="card mt-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-white">Team Members</h3>
            <p className="text-xs text-zinc-400">Collaborators assigned to this hackathon squad.</p>
          </div>
          <button
            onClick={() => router.push("/team-setup")}
            className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-medium"
          >
            Manage Team <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {teamMembers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="glass rounded-xl flex items-center p-3.5 hover:border-zinc-700 transition-colors"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-10 h-10 rounded-full mr-3 border border-zinc-700 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate text-white">{member.name}</p>
                  <p className="text-xs text-zinc-400 truncate">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 glass rounded-xl border border-dashed border-zinc-700/60">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-white">No team members yet</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto mb-4">
              Add teammates to collaborate, assign tasks, and share files across your project.
            </p>
            <button
              onClick={() => router.push("/team-setup")}
              className="btn-primary text-xs px-4 py-2"
            >
              Add Team Members
            </button>
          </div>
        )}
      </div>
    </>
  );
}
