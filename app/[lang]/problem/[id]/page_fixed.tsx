'use client';

import React, { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Problem, ProblemQuestion, ProblemComment } from '@/lib/types';
import { buildProblemKnowledge, analyzeQuestionV8, calculateAnswerSimilarity, initializeModel, type ProblemKnowledge } from '@/lib/ai-analyzer';
import { buildProblemKnowledge as buildProblemKnowledgeEn, analyzeQuestionV8 as analyzeQuestionV8En, calculateAnswerSimilarityEn, initializeModel as initializeModelEn, type ProblemKnowledge as ProblemKnowledgeEn } from '@/lib/ai-analyzer-en';
import ProblemAdminButtons from './ProblemAdminButtons';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';
import { createNotification } from '@/lib/notifications';
import { checkIfLearnedError } from '@/lib/check-learned-error';
import JsonLd from '@/components/JsonLd';
import QuizPlayMCQ from '@/components/quiz/QuizPlayMCQ';
import QuizPlayOX from '@/components/quiz/QuizPlayOX';
import QuizPlayImage from '@/components/quiz/QuizPlayImage';
import QuizPlayBalance from '@/components/quiz/QuizPlayBalance';
import type { QuizType } from '@/lib/types/quiz';
import ProblemHeader from './components/ProblemHeader';
import ProblemContent from './components/ProblemContent';
import ShareModal from './components/ShareModal';
import CommentsSection from './components/CommentsSection';
import BugReportModal from './components/BugReportModal';
import ProblemCTABar from './components/ProblemCTABar';

// ... existing code ...
