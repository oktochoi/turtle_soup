'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';

interface ContactFormProps {
  locale: Locale;
  contactEmail: string;
}

export default function ContactForm({ locale, contactEmail }: ContactFormProps) {
  const isKo = locale === 'ko';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // mailto 링크로 이메일 클라이언트 열기
    const subject = encodeURIComponent(formData.subject || (isKo ? '문의사항' : 'Inquiry'));
    const body = encodeURIComponent(
      `${isKo ? '이름' : 'Name'}: ${formData.name}\n${isKo ? '이메일' : 'Email'}: ${formData.email}\n\n${isKo ? '내용' : 'Message'}:\n${formData.message}`
    );
    const mailtoLink = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
    
    window.location.href = mailtoLink;
    
    // 폼 초기화
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2 text-slate-300">
          {isKo ? '이름' : 'Name'} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          placeholder={isKo ? '이름을 입력하세요' : 'Enter your name'}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2 text-slate-300">
          {isKo ? '이메일' : 'Email'} <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          id="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          placeholder={isKo ? '이메일을 입력하세요' : 'Enter your email'}
        />
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium mb-2 text-slate-300">
          {isKo ? '제목' : 'Subject'} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="subject"
          required
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          placeholder={isKo ? '문의 제목을 입력하세요' : 'Enter subject'}
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-2 text-slate-300">
          {isKo ? '내용' : 'Message'} <span className="text-red-400">*</span>
        </label>
        <textarea
          id="message"
          required
          rows={6}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          placeholder={isKo ? '문의 내용을 입력하세요' : 'Enter your message'}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center">
            <i className="ri-loader-4-line animate-spin mr-2"></i>
            {isKo ? '전송 중...' : 'Sending...'}
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <i className="ri-mail-send-line mr-2"></i>
            {isKo ? '이메일로 전송' : 'Send via Email'}
          </span>
        )}
      </button>

      <p className="text-xs text-slate-400 text-center">
        {isKo
          ? '* 이메일 클라이언트가 열립니다. 이메일을 보내주시면 빠르게 답변드리겠습니다.'
          : '* Your email client will open. Please send us an email and we will respond quickly.'}
      </p>
    </form>
  );
}

