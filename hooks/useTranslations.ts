'use client';

import { useParams } from 'next/navigation';
import { getMessages, type Locale } from '@/lib/i18n';
import { useMemo } from 'react';

type Messages = ReturnType<typeof getMessages>;

export function useTranslations(): Messages {
  const params = useParams();
  const locale = (params?.lang as Locale) || 'ko';

  const messages = useMemo(() => {
    return getMessages(locale);
  }, [locale]);

  return messages;
}

