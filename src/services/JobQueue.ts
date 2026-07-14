import { eventBus } from "./EventBus";

export type JobType =
  | "metadata_fetch"
  | "image_download"
  | "statistics_compute"
  | "cache_cleanup"
  | "discovery_refresh"
  | "search_index";

export type JobPriority = "high" | "normal" | "low";
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface BackgroundJob<T = unknown> {
  id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  payload: T;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface JobDefinition<T = unknown> {
  type: JobType;
  maxConcurrent: number;
  handler: (job: BackgroundJob<T>) => Promise<void>;
}

export class JobQueue {
  private jobs = new Map<string, BackgroundJob>();
  private queue: BackgroundJob[] = [];
  private activeJobs = new Map<JobType, Set<string>>();
  private definitions = new Map<JobType, JobDefinition>();
  private isProcessing = false;

  constructor() {
    // Initialize active job tracking for all known types
    const jobTypes: JobType[] = [
      "metadata_fetch",
      "image_download",
      "statistics_compute",
      "cache_cleanup",
      "discovery_refresh",
      "search_index",
    ];
    jobTypes.forEach((type) => this.activeJobs.set(type, new Set()));
  }

  /**
   * Register a job handler with its concurrency limits
   */
  registerHandler<T>(definition: JobDefinition<T>): void {
    this.definitions.set(definition.type, definition as JobDefinition<unknown>);
  }

  /**
   * Enqueue a new job
   * @returns The generated Job ID
   */
  enqueue<T>(type: JobType, payload: T, priority: JobPriority = "normal"): string {
    const id = crypto.randomUUID();
    const job: BackgroundJob = {
      id,
      type,
      priority,
      status: "pending",
      payload,
      createdAt: Date.now(),
    };

    this.jobs.set(id, job);
    this.queue.push(job);
    this.sortQueue();

    // Start processing asynchronously
    setTimeout(() => this.processQueue(), 0);

    return id;
  }

  /**
   * Cancel a pending or running job
   */
  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (job.status === "pending" || job.status === "running") {
      const wasPending = job.status === "pending";
      job.status = "cancelled";
      job.completedAt = Date.now();
      
      // If it was pending, remove it from queue
      if (wasPending) {
        this.queue = this.queue.filter((j) => j.id !== jobId);
      }
      
      // If it was running, the handler should ideally check job.status,
      // but we remove it from active tracking immediately
      this.activeJobs.get(job.type)?.delete(jobId);
      
      this.processQueue();
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): BackgroundJob | undefined {
    return this.jobs.get(jobId);
  }

  private sortQueue(): void {
    const priorityWeight = { high: 3, normal: 2, low: 1 };
    
    this.queue.sort((a, b) => {
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;
      // FIFO for same priority
      return a.createdAt - b.createdAt;
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Find jobs we can start
      // Iterate over a copy of the queue so we can safely remove items
      const currentQueue = [...this.queue];
      
      for (const job of currentQueue) {
        if (job.status !== "pending") continue;

        const definition = this.definitions.get(job.type);
        if (!definition) {
          console.warn(`[JobQueue] No handler registered for job type: ${job.type}`);
          job.status = "failed";
          job.error = "No handler registered";
          this.queue = this.queue.filter(j => j.id !== job.id);
          continue;
        }

        const activeCount = this.activeJobs.get(job.type)?.size || 0;
        
        // Check concurrency limits
        if (activeCount < definition.maxConcurrent) {
          // Start the job
          this.startJob(job, definition);
          
          // Remove from pending queue
          this.queue = this.queue.filter(j => j.id !== job.id);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async startJob(job: BackgroundJob, definition: JobDefinition): Promise<void> {
    job.status = "running";
    job.startedAt = Date.now();
    this.activeJobs.get(job.type)?.add(job.id);
    
    eventBus.emit("job:started", { jobId: job.id, type: job.type });

    try {
      // Execute the handler
      await definition.handler(job);
      
      // Check if it was cancelled during execution
      if ((job.status as JobStatus) !== "cancelled") {
        job.status = "completed";
        job.completedAt = Date.now();
        eventBus.emit("job:completed", { jobId: job.id, type: job.type });
      }
    } catch (error) {
      if ((job.status as JobStatus) !== "cancelled") {
        job.status = "failed";
        job.completedAt = Date.now();
        job.error = error instanceof Error ? error.message : String(error);
        console.error(`[JobQueue] Job ${job.id} failed:`, error);
        eventBus.emit("job:failed", { jobId: job.id, type: job.type, error: job.error });
      }
    } finally {
      this.activeJobs.get(job.type)?.delete(job.id);
      
      // Keep completed/failed/cancelled jobs in the map for a while?
      // For now, we leave them in the map. A cleanup routine could clear old jobs.
      
      // Trigger processing loop again in case there are pending jobs
      setTimeout(() => this.processQueue(), 0);
    }
  }
}

export const jobQueue = new JobQueue();
