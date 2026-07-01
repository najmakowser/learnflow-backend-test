import { useState } from 'react';
import { CheckCircle2, Brain, SearchCheck, ClipboardCheck, BookOpen, GraduationCap, BadgeCheck, Users, UserPlus2, Mail, BellRing, BarChart3 } from 'lucide-react';

const STEPS = [
  {
    id: 'submit',
    actor: 'Functional Head',
    actorClass: 'bg-emerald-100 text-emerald-700',
    borderClass: 'border-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    title: 'Submit Training Request',
    kind: 'Human',
    description: 'Functional Head raises either a catalog request or a new-course request with the team business need and expected outcomes.',
    details: ['Creates the initial workflow record', 'Starts the AI analysis sequence', 'Routes to L&D for review'],
    icon: CheckCircle2,
  },
  {
    id: 'need-analysis',
    actor: 'AI Agent 1',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Learning Need Analysis Agent',
    kind: 'AI',
    description: 'Evaluates urgency, business objectives, and the most important skill gaps from the submitted request.',
    details: ['Priority score and rationale', 'Refined objectives', 'Normalized skill-gap summary'],
    icon: Brain,
  },
  {
    id: 'course-recommendation',
    actor: 'AI Agent 2',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Course Recommendation Agent',
    kind: 'AI',
    description: 'Checks whether the request should reuse an existing catalog course or continue as a new-course build.',
    details: ['Reuse vs create decision', 'Top catalog matches with similarity score', 'Decision rationale for L&D review'],
    icon: SearchCheck,
  },
  {
    id: 'ld-review',
    actor: 'L&D Team',
    actorClass: 'bg-sky-100 text-sky-700',
    borderClass: 'border-sky-400',
    badgeClass: 'bg-sky-50 text-sky-700',
    title: 'L&D Request Review',
    kind: 'Human',
    description: 'L&D validates the request, confirms the direction, and approves the item for curriculum creation.',
    details: ['Checks business alignment', 'Confirms feasibility', 'Moves approved requests to curriculum stage'],
    icon: ClipboardCheck,
  },
  {
    id: 'curriculum-builder',
    actor: 'AI Agent 3',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Curriculum Builder Agent',
    kind: 'AI',
    description: 'Generates the full curriculum structure with modules, outcomes, assessments, and business impact.',
    details: ['Structured curriculum JSON', 'Editable curriculum outline', 'Standard document attachment for manager review'],
    icon: BookOpen,
  },
  {
    id: 'trainer-recommendation',
    actor: 'AI Agent 4',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Trainer Recommendation Agent',
    kind: 'AI',
    description: 'Ranks the strongest trainer options for the built curriculum based on course fit and prior catalog alignment.',
    details: ['Top 3 ranked trainers', 'Fit score per trainer', 'Reason for each recommendation'],
    icon: GraduationCap,
  },
  {
    id: 'curriculum-approval',
    actor: 'Functional Head',
    actorClass: 'bg-emerald-100 text-emerald-700',
    borderClass: 'border-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    title: 'Curriculum Approval',
    kind: 'Human',
    description: 'Functional Head reviews the shared curriculum, approves it, or sends it back with revision comments.',
    details: ['Download and review curriculum', 'Approve or reject with comments', 'Unlock participant nomination after approval'],
    icon: BadgeCheck,
  },
  {
    id: 'participant-recommendation',
    actor: 'AI Agent 5',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Participant Recommendation Agent',
    kind: 'AI',
    description: 'Ranks employees in the target department by fit and headroom against the requested skill uplift.',
    details: ['Top employee shortlist', 'Fit score for each employee', 'Prefill support for manager nomination'],
    icon: Users,
  },
  {
    id: 'participant-nomination',
    actor: 'Functional Head',
    actorClass: 'bg-emerald-100 text-emerald-700',
    borderClass: 'border-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    title: 'Participant Nomination',
    kind: 'Human',
    description: 'Functional Head confirms the final participant list and moves the request into finalized enrollment handling.',
    details: ['Manager confirms nominees', 'Skill levels captured for each participant', 'Ready for final L&D processing'],
    icon: UserPlus2,
  },
  {
    id: 'final-review',
    actor: 'L&D Team',
    actorClass: 'bg-sky-100 text-sky-700',
    borderClass: 'border-sky-400',
    badgeClass: 'bg-sky-50 text-sky-700',
    title: 'Final Nomination Review',
    kind: 'Human',
    description: 'L&D verifies the final list and ensures the enrollment package is ready for release.',
    details: ['Reviews final participant readiness', 'Confirms enrollment status', 'Hands off to automation'],
    icon: ClipboardCheck,
  },
  {
    id: 'registration-automation',
    actor: 'AI Agent 6',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Registration Automation Agent',
    kind: 'AI',
    description: 'Generates enrollment links and simulates email and collaboration notifications for approved learners.',
    details: ['Enrollment link package', 'Email trigger summary', 'Teams-style notification summary'],
    icon: Mail,
  },
  {
    id: 'reminder-agent',
    actor: 'AI Agent 7',
    actorClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Reminder Agent',
    kind: 'AI',
    description: 'Runs scheduled reminders for 7-day, 3-day, and day-of training events from the finalized enrollment list.',
    details: ['7-day reminders', '3-day reminders', 'Day-of reminders'],
    icon: BellRing,
  },
  {
    id: 'dashboard-insights',
    actor: 'System',
    actorClass: 'bg-amber-100 text-amber-700',
    borderClass: 'border-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700',
    title: 'Dashboards & AI Insights',
    kind: 'Auto',
    description: 'The workflow state, approvals, and automation outputs roll up into dashboard metrics, audit events, and tracker visibility.',
    details: ['Live queue counts', 'Workflow tracking visibility', 'Audit trail of AI and human actions'],
    icon: BarChart3,
  },
];

export default function WorkflowAgentMap() {
  const [openId, setOpenId] = useState('need-analysis');

  return (
    <div className="card !p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">AI-Powered LMS Full Workflow & Agent Map</h2>
        <p className="mt-1 text-sm text-slate-500">Click any step to expand details</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Functional Head</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-500" /> L&D Team</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-violet-500" /> AI Agent</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Automated System</span>
      </div>

      <div className="mt-8 space-y-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const open = openId === step.id;
          return (
            <div key={step.id} className="grid gap-3 md:grid-cols-[180px_24px_minmax(0,1fr)] md:items-start">
              <div className="flex md:justify-end">
                <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${step.actorClass}`}>
                  {step.actor}
                </span>
              </div>

              <div className="relative hidden md:flex justify-center pt-2">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-200" />
                <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white ${step.actor.includes('Functional') ? 'bg-emerald-500' : step.actor.includes('L&D') ? 'bg-sky-500' : step.actor === 'System' ? 'bg-amber-500' : 'bg-violet-500'}`} />
              </div>

              <button
                type="button"
                onClick={() => setOpenId(open ? '' : step.id)}
                className={`w-full rounded-2xl border-l-4 ${step.borderClass} bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-slate-50 p-2 text-slate-600">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-800">{step.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${step.badgeClass}`}>{step.kind}</span>
                </div>

                {open && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="grid gap-2 md:grid-cols-3">
                      {step.details.map((detail) => (
                        <div key={detail} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                          {detail}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-400">Step {index + 1} of {STEPS.length}</p>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
