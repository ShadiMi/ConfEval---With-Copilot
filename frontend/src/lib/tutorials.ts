import type { Step } from 'react-joyride';
import { UserRole } from '@/types';

export interface HelpSection {
  heading: string;
  description: string;
  bullets: string[];
  href?: string;
  linkLabel?: string;
}

export interface TutorialTour {
  intro: string;
  steps: Step[];
}

const commonOuterSteps = (welcomeBody: string): Step[] => [
  {
    target: 'body',
    title: 'Welcome to ConfEval',
    content: welcomeBody,
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Your dashboard',
    content:
      'Your home base. It surfaces what needs your attention right now — open it any time from here.',
    placement: 'bottom',
    disableBeacon: true,
  },
];

const commonClosingSteps: Step[] = [
  {
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content:
      'New activity that involves you (assignments, status changes, replies) shows up here. The dot turns red when you have unread items.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="user-menu"]',
    title: 'Profile & sign out',
    content:
      'Update your profile, tags, and CV here. Keeping these current makes matchmaking much more accurate.',
    placement: 'bottom-end',
    disableBeacon: true,
  },
  {
    target: '[data-tour="help"]',
    title: 'Help is always here',
    content:
      'Open this menu any time to restart the tour, read the full help page, or contact support.',
    placement: 'bottom-end',
    disableBeacon: true,
  },
];

export const tutorialTour: Record<UserRole, TutorialTour> = {
  student: {
    intro:
      'As a student you submit projects, get them advised, and apply them to review sessions.',
    steps: [
      ...commonOuterSteps(
        'As a student you submit projects, get them advised, and apply them to review sessions. This quick tour walks you through your menu.'
      ),
      {
        target: '[data-tour="nav-projects"]',
        title: 'My Projects',
        content:
          'Create projects, attach papers/slides, pick tags, list team members and an advisor. Edit freely until the project is locked for review.',
        placement: 'bottom',
        disableBeacon: true,
      },
      ...commonClosingSteps,
    ],
  },

  internal_reviewer: {
    intro:
      'You advise student projects, apply to review sessions, and submit reviews based on admin-defined criteria.',
    steps: [
      ...commonOuterSteps(
        'You advise student projects, apply to review sessions, and submit reviews based on admin-defined criteria. Here is your menu.'
      ),
      {
        target: '[data-tour="nav-applications"]',
        title: 'My Applications',
        content:
          'Browse open sessions and apply to review them. Admins approve applications and then assign you to projects.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-advising"]',
        title: 'Advising',
        content:
          'When a student lists you as advisor (by email), their project appears here so you can give feedback before it goes to review.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-reviews"]',
        title: 'Reviews',
        content:
          'Assigned projects show up here. Score each criterion, leave written feedback, and submit before the deadline.',
        placement: 'bottom',
        disableBeacon: true,
      },
      ...commonClosingSteps,
    ],
  },

  external_reviewer: {
    intro:
      'You apply to review sessions and submit reviews for the projects you are assigned to.',
    steps: [
      ...commonOuterSteps(
        'You apply to review sessions and submit reviews for the projects you are assigned to. Here is your menu.'
      ),
      {
        target: '[data-tour="nav-applications"]',
        title: 'My Applications',
        content:
          'Browse open sessions and apply to review them. An admin reviews your application before you are assigned to projects.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-reviews"]',
        title: 'Reviews',
        content:
          'Assigned projects appear here. Score the criteria, add comments, and submit before the deadline.',
        placement: 'bottom',
        disableBeacon: true,
      },
      ...commonClosingSteps,
    ],
  },

  admin: {
    intro:
      'You run the platform end-to-end: users, conferences, sessions, projects, reviewer assignments, tags, reports, and global settings.',
    steps: [
      ...commonOuterSteps(
        'You run the platform end-to-end. This tour highlights the main admin areas in your menu.'
      ),
      {
        target: '[data-tour="nav-admin-users"]',
        title: 'Users',
        content:
          'Approve new reviewers, change roles, and deactivate accounts. The red badge shows pending approvals.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-admin-conferences"]',
        title: 'Conferences & sessions',
        content:
          'Create conferences and sessions, set deadlines, criteria, and required tags. Open or close sessions to control submissions.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-admin-projects"]',
        title: 'Projects',
        content:
          'Review submitted projects, approve or reject, and inspect attachments before assigning reviewers.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-admin-applications"]',
        title: 'Applications',
        content:
          'Approve reviewer applications to sessions before they can be assigned.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-admin-assignments"]',
        title: 'Assignments',
        content:
          'Match approved reviewers to projects. Use tag overlap and CV info to pick the right people.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-admin-tags"]',
        title: 'Tags',
        content:
          'Maintain the tag taxonomy used across projects, users, and sessions.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="nav-admin-reports"]',
        title: 'Reports',
        content: 'Aggregated review outcomes per session for export.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="admin-settings"]',
        title: 'System settings',
        content:
          'Set the default internal-reviewer affiliation and the support contact info shown to users.',
        placement: 'bottom-end',
        disableBeacon: true,
      },
      ...commonClosingSteps,
    ],
  },
};

export const helpSections: Record<UserRole, HelpSection[]> = {
  student: [
    {
      heading: 'Dashboard',
      description: 'Your home base after logging in.',
      bullets: [
        'See active projects and recent notifications at a glance.',
        'Jump to upcoming sessions with one click.',
      ],
      href: '/dashboard',
      linkLabel: 'Open dashboard',
    },
    {
      heading: 'Create and manage projects',
      description: 'Projects are the unit of work you submit for review.',
      bullets: [
        'Click "New project" to start a draft.',
        'Attach a paper, slides, and any supporting files.',
        'Add team members by email and pick an advisor.',
        'Tag the project so admins and reviewers can find it.',
        'Edit freely until the project is locked for review.',
      ],
      href: '/projects',
      linkLabel: 'Open My Projects',
    },
    {
      heading: 'Browse conferences and sessions',
      description:
        'Sessions live inside conferences and define what gets reviewed.',
      bullets: [
        'Open a conference to see its sessions and deadlines.',
        'Check required tags before applying — they determine eligibility.',
      ],
      href: '/conferences',
      linkLabel: 'Browse conferences',
    },
    {
      heading: 'Apply your project to a session',
      description: 'Submit a finished project for review.',
      bullets: [
        'Open a session and click "Submit project".',
        'Pick an eligible project from the list.',
        'Wait for reviewer assignment — you will be notified.',
        'Read the published reviews when the session closes.',
      ],
      href: '/sessions',
      linkLabel: 'View sessions',
    },
    {
      heading: 'Keep your profile up to date',
      description:
        'Your tags and contact info affect matchmaking and notifications.',
      bullets: [
        'Update interests so the right sessions are suggested.',
        'Upload or refresh your CV.',
        'Keep your phone and ID number current.',
      ],
      href: '/profile',
      linkLabel: 'Edit profile',
    },
  ],

  internal_reviewer: [
    {
      heading: 'Dashboard',
      description: 'See what needs your attention today.',
      bullets: [
        'Pending reviews assigned to you.',
        'Sessions you applied to and their status.',
        'Projects where you are listed as advisor.',
      ],
      href: '/dashboard',
      linkLabel: 'Open dashboard',
    },
    {
      heading: 'Apply to review sessions',
      description: 'Tell admins which sessions you can review.',
      bullets: [
        'Open My Applications and pick an open session.',
        'Submit a short note about your interest and availability.',
        'Track approval status from the same page.',
      ],
      href: '/applications',
      linkLabel: 'My Applications',
    },
    {
      heading: 'Advise projects',
      description: 'Help students before their project is submitted for review.',
      bullets: [
        'If a student lists your email as advisor, the project appears under Advising.',
        'Leave comments and suggestions early.',
        'Mark feedback resolved once addressed.',
      ],
      href: '/advising',
      linkLabel: 'Open Advising',
    },
    {
      heading: 'Submit reviews',
      description: 'Score and comment on projects assigned to you.',
      bullets: [
        'Open a review from the Reviews page.',
        'Score each criterion set by the admin.',
        'Add written feedback for the team.',
        'Submit before the session deadline.',
      ],
      href: '/reviews',
      linkLabel: 'Open Reviews',
    },
    {
      heading: 'Profile and interests',
      description: 'Tags drive which sessions you get suggested for.',
      bullets: [
        'Update your areas of interest.',
        'Refresh your CV when it changes.',
      ],
      href: '/profile',
      linkLabel: 'Edit profile',
    },
  ],

  external_reviewer: [
    {
      heading: 'Dashboard',
      description: 'See pending reviews and application status.',
      bullets: [
        'Pending reviews to submit.',
        'Sessions you applied to and admin decisions.',
      ],
      href: '/dashboard',
      linkLabel: 'Open dashboard',
    },
    {
      heading: 'Apply to review sessions',
      description: 'Let admins know you are available.',
      bullets: [
        'Browse open sessions in My Applications.',
        'Submit an application with a short note.',
        'Wait for admin approval — you will be notified.',
      ],
      href: '/applications',
      linkLabel: 'My Applications',
    },
    {
      heading: 'Submit reviews',
      description: 'Once assigned, the project shows up under Reviews.',
      bullets: [
        'Open the review and read the project files.',
        'Score each criterion.',
        'Add comments and submit before the deadline.',
      ],
      href: '/reviews',
      linkLabel: 'Open Reviews',
    },
    {
      heading: 'Profile and CV',
      description:
        'Tags and a current CV help admins assign you to the right projects.',
      bullets: ['Update interests.', 'Upload an up-to-date CV.'],
      href: '/profile',
      linkLabel: 'Edit profile',
    },
  ],

  admin: [
    {
      heading: 'Approve users',
      description: 'New reviewers cannot apply until approved.',
      bullets: [
        'Open Users — a red badge shows pending count.',
        'Review each pending reviewer and approve or reject.',
        'Change roles or deactivate accounts as needed.',
      ],
      href: '/admin/users',
      linkLabel: 'Manage Users',
    },
    {
      heading: 'Conferences and sessions',
      description:
        'Sessions are the unit reviewers apply to and submit to.',
      bullets: [
        'Create a conference, then add sessions.',
        'Set deadlines, criteria, and required tags for each session.',
        'Open or close a session to control submissions.',
      ],
      href: '/admin/conferences',
      linkLabel: 'Manage Conferences',
    },
    {
      heading: 'Projects and applications',
      description: 'Approve incoming work before assigning reviewers.',
      bullets: [
        'Review submitted projects under Projects.',
        'Approve reviewer applications under Applications.',
      ],
      href: '/admin/projects',
      linkLabel: 'Manage Projects',
    },
    {
      heading: 'Assign reviewers',
      description: 'Match approved reviewers to projects.',
      bullets: [
        'Open Assignments to see eligible reviewers per project.',
        'Use tag overlap and CV info to pick the right people.',
        'Reviewers are notified when assigned.',
      ],
      href: '/admin/assignments',
      linkLabel: 'Open Assignments',
    },
    {
      heading: 'Tags and reports',
      description: 'Curate the taxonomy and read outcomes.',
      bullets: [
        'Maintain tags used across projects, users, and sessions.',
        'Reports aggregate review outcomes per session for export.',
      ],
      href: '/admin/reports',
      linkLabel: 'View Reports',
    },
    {
      heading: 'System settings',
      description: 'Global configuration that affects every role.',
      bullets: [
        'Set the default affiliation for internal reviewers.',
        'Set the support email and phone shown in the Help menu and footer.',
      ],
      href: '/admin/settings',
      linkLabel: 'Open Settings',
    },
  ],
};
