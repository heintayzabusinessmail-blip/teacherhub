import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Inbox,
  Lock,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES, SURVEY_HELP_TOPICS } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import type { FaqItem } from '../types';

export function VoicePage() {
  const { user, isAdmin, myProfile, mySurvey, faqs, suggestions } = useHub();

  // 1. Month 1 Needs Survey State
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [feedbackStyle, setFeedbackStyle] = useState('');
  const [bestTimes, setBestTimes] = useState('');
  const [ideas, setIdeas] = useState('');
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [surveySavedMsg, setSurveySavedMsg] = useState('');

  useEffect(() => {
    if (mySurvey) {
      setSelectedTopics(mySurvey.helpTopics || []);
      setFeedbackStyle(mySurvey.feedbackStyle || '');
      setBestTimes(mySurvey.bestTimes || '');
      setIdeas(mySurvey.ideas || '');
    }
  }, [mySurvey]);

  // 2. Shared FAQ State
  const [faqQuery, setFaqQuery] = useState('');
  const [showAskFaq, setShowAskFaq] = useState(false);
  const [qText, setQText] = useState('');
  const [qLevel, setQLevel] = useState('B1');
  const [qCategory, setQCategory] = useState('Grammar');
  const [postingFaq, setPostingFaq] = useState(false);

  const [answeringFaqId, setAnsweringFaqId] = useState<string | null>(null);
  const [ansExplanation, setAnsExplanation] = useState('');
  const [ansExample, setAnsExample] = useState('');
  const [ansCheckingQ, setAnsCheckingQ] = useState('');
  const [savingAnswer, setSavingAnswer] = useState(false);

  // 3. Anonymous Suggestion Box
  const [sugCategory, setSugCategory] = useState('General Idea');
  const [sugMessage, setSugMessage] = useState('');
  const [sendingSug, setSendingSug] = useState(false);
  const [sugDone, setSugDone] = useState(false);
  const [sugError, setSugError] = useState('');

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 10 ? [...prev, t] : prev
    );
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSurvey(true);
    setSurveySavedMsg('');
    try {
      const now = serverTimestamp();
      const payload = {
        uid: user.uid,
        teacherName: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
        helpTopics: selectedTopics.slice(0, 10),
        feedbackStyle: feedbackStyle.trim().slice(0, 200),
        bestTimes: bestTimes.trim().slice(0, 200),
        ideas: ideas.trim().slice(0, 1000),
        isSample: false,
        updatedAt: now,
      };
      if (mySurvey) {
        await updateDoc(doc(db, 'needsSurveys', user.uid), {
          teacherName: payload.teacherName,
          helpTopics: payload.helpTopics,
          feedbackStyle: payload.feedbackStyle,
          bestTimes: payload.bestTimes,
          ideas: payload.ideas,
          updatedAt: now,
        });
      } else {
        await setDoc(doc(db, 'needsSurveys', user.uid), {
          ...payload,
          createdAt: now,
        });
      }

      if (myProfile && !myProfile.checklist.surveyDone) {
        await updateDoc(doc(db, 'teachers', user.uid), {
          checklist: { ...myProfile.checklist, surveyDone: true },
          updatedAt: now,
        });
      }

      setSurveySavedMsg('Thank you! Your Month 1 Needs Survey is saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `needsSurveys/${user.uid}`);
    } finally {
      setSavingSurvey(false);
    }
  };

  const filteredFaqs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) =>
      `${f.question} ${f.level} ${f.category} ${f.explanation} ${f.example}`
        .toLowerCase()
        .includes(q)
    );
  }, [faqs, faqQuery]);

  const handleAskFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !qText.trim()) return;
    setPostingFaq(true);
    try {
      const now = serverTimestamp();
      await addDoc(collection(db, 'faqs'), {
        question: qText.trim().slice(0, 400),
        level: qLevel,
        category: qCategory,
        explanation: '',
        example: '',
        checkingQuestion: '',
        askedByUid: user.uid,
        askedByName: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
        answeredBy: '',
        status: 'open',
        isSample: false,
        createdAt: now,
        updatedAt: now,
      });
      setQText('');
      setShowAskFaq(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'faqs');
    } finally {
      setPostingFaq(false);
    }
  };

  const openAnswerFaq = (faq: FaqItem) => {
    setAnsweringFaqId(faq.id);
    setAnsExplanation(faq.explanation || '');
    setAnsExample(faq.example || '');
    setAnsCheckingQ(faq.checkingQuestion || '');
  };

  const handleSaveFaqAnswer = async (faqId: string) => {
    if (!ansExplanation.trim()) return;
    setSavingAnswer(true);
    try {
      await updateDoc(doc(db, 'faqs', faqId), {
        explanation: ansExplanation.trim().slice(0, 1200),
        example: ansExample.trim().slice(0, 600),
        checkingQuestion: ansCheckingQ.trim().slice(0, 400),
        answeredBy: (myProfile?.displayName || user?.displayName || 'YAO Team').slice(0, 120),
        status: 'answered',
        updatedAt: serverTimestamp(),
      });
      setAnsweringFaqId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `faqs/${faqId}`);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleSendSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sugMessage.trim()) return;
    setSendingSug(true);
    setSugDone(false);
    setSugError('');
    try {
      await addDoc(collection(db, 'suggestions'), {
        category: sugCategory.slice(0, 80),
        message: sugMessage.trim().slice(0, 1000),
        isSample: false,
        createdAt: serverTimestamp(),
      });
      setSugMessage('');
      setSugDone(true);
    } catch (err) {
      setSugError('Could not send your message right now. Please try again.');
      handleFirestoreError(err, OperationType.CREATE, 'suggestions');
    } finally {
      setSendingSug(false);
    }
  };

  const handleArchiveSuggestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'suggestions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suggestions/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Teacher Voice: Needs Survey, Shared FAQ & Ideas" inShort={PAGE_SUMMARIES.voice} />

      {/* 1. Month 1 Needs Survey */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#A8567F]" />
              Month 1 Teacher Needs Survey
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5">
              Tell Tr Hein what helps you most — your answers directly choose our workshop topics.
            </p>
          </div>
          {mySurvey && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Submitted (you can update anytime)
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSurvey} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9] mb-2">
              1. What help would be most useful for your classes? (Pick all that apply)
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              {SURVEY_HELP_TOPICS.map((topic) => {
                const checked = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left text-sm font-medium transition-colors flex items-center gap-2.5 ${
                      checked
                        ? 'bg-[#3B1050] border-[#3B1050] text-white'
                        : 'bg-[#FAF7FC] dark:bg-[#160F1F] border-[#E5D9EC] dark:border-[#332442] text-[#1F122B] dark:text-[#F5EEF9]'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${checked ? 'opacity-100' : 'opacity-30'}`} />
                    <span>{topic}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                2. How do you like receiving feedback?
              </label>
              <input
                type="text"
                maxLength={200}
                value={feedbackStyle}
                onChange={(e) => setFeedbackStyle(e.target.value)}
                placeholder="e.g., Short friendly Zoom chat + 2 bullet points in writing"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                3. Best days & times for training workshops?
              </label>
              <input
                type="text"
                maxLength={200}
                value={bestTimes}
                onChange={(e) => setBestTimes(e.target.value)}
                placeholder="e.g., Weekday afternoons or Saturday mornings"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9] mb-1">
              4. Any ideas, requests, or worries for Month 1?
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={ideas}
              onChange={(e) => setIdeas(e.target.value)}
              placeholder="Share anything that would make teaching at YAO easier and more enjoyable..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {surveySavedMsg ? (
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {surveySavedMsg}
              </span>
            ) : (
              <span className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Visible only to you, Tr Hein, and the Founder.
              </span>
            )}
            <button
              type="submit"
              disabled={savingSurvey}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold disabled:opacity-60"
            >
              {savingSurvey ? 'Saving...' : mySurvey ? 'Update my survey' : 'Submit survey'}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Shared FAQ — Hard Student Questions */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#A8567F]" />
              Shared Teacher FAQ (Hard Student Questions)
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Every answer includes a level-appropriate explanation, a clear example, and a checking
              question you can use directly in class.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAskFaq((v) => !v)}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Ask a student question
          </button>
        </div>

        {showAskFaq && (
          <form
            onSubmit={handleAskFaq}
            className="p-4 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-3"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                value={qLevel}
                onChange={(e) => setQLevel(e.target.value)}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              >
                {['A1', 'A2', 'B1', 'B2', 'C1', 'All Levels'].map((l) => (
                  <option key={l} value={l}>
                    Level: {l}
                  </option>
                ))}
              </select>
              <select
                value={qCategory}
                onChange={(e) => setQCategory(e.target.value)}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              >
                {['Grammar', 'Vocabulary', 'Pronunciation', 'Speaking', 'Writing', 'Zoom / Classroom'].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>
            <textarea
              rows={2}
              required
              maxLength={400}
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder='e.g., How do I explain the difference between "must" and "have to" to a B1 class?'
              className="w-full px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAskFaq(false)}
                className="min-h-[40px] px-4 py-1.5 rounded-xl border border-[#E5D9EC] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={postingFaq}
                className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                {postingFaq ? 'Posting...' : 'Post question'}
              </button>
            </div>
          </form>
        )}

        <div className="relative">
          <Search className="w-4 h-4 text-[#7A6888] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={faqQuery}
            onChange={(e) => setFaqQuery(e.target.value)}
            placeholder="Search student questions (e.g., since vs for, -ed endings, borrow/lend)..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
          />
        </div>

        {filteredFaqs.length === 0 ? (
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] py-6 text-center">
            No FAQ items match yet. Submit a tricky student question above and we will answer it
            together!
          </p>
        ) : (
          <div className="space-y-4">
            {filteredFaqs.map((faq) => {
              const isAnswering = answeringFaqId === faq.id;
              return (
                <article
                  key={faq.id}
                  className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                        <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                          {faq.level}
                        </span>
                        {' · '}
                        {faq.category}
                        {' · '}
                        {faq.status === 'answered' ? `Answered by ${faq.answeredBy}` : 'Waiting for answer'}
                      </p>
                      <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                        {faq.question}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isAnswering ? setAnsweringFaqId(null) : openAnswerFaq(faq))}
                      className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline shrink-0"
                    >
                      {isAnswering ? 'Close' : faq.status === 'answered' ? 'Improve answer' : 'Write answer'}
                    </button>
                  </div>

                  {faq.status === 'answered' && !isAnswering && (
                    <div className="grid md:grid-cols-3 gap-4 pt-2 border-t border-[#E5D9EC] dark:border-[#332442] text-sm">
                      <div>
                        <p className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                          Simple Explanation
                        </p>
                        <p className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5 leading-relaxed">
                          {faq.explanation}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">
                          Clear Example
                        </p>
                        <p className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5 leading-relaxed">
                          {faq.example || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          Checking Question (CCQ)
                        </p>
                        <p className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5 leading-relaxed">
                          {faq.checkingQuestion || '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {isAnswering && (
                    <div className="space-y-3 pt-2 border-t border-[#E5D9EC] dark:border-[#332442]">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Level-appropriate explanation *
                        </label>
                        <textarea
                          rows={2}
                          maxLength={1200}
                          value={ansExplanation}
                          onChange={(e) => setAnsExplanation(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Clear example</label>
                          <input
                            type="text"
                            maxLength={600}
                            value={ansExample}
                            onChange={(e) => setAnsExample(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Checking question (CCQ)
                          </label>
                          <input
                            type="text"
                            maxLength={400}
                            value={ansCheckingQ}
                            onChange={(e) => setAnsCheckingQ(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAnsweringFaqId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5D9EC] text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingAnswer}
                          onClick={() => handleSaveFaqAnswer(faq.id)}
                          className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                        >
                          {savingAnswer ? 'Saving...' : 'Save FAQ answer'}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Anonymous Suggestion Box */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#A8567F]" />
              Anonymous Suggestion Box
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Your name and user ID are NOT stored with this message. Only Tr Hein and the Founder
              can read suggestions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendSuggestion} className="space-y-3">
          <select
            value={sugCategory}
            onChange={(e) => setSugCategory(e.target.value)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
          >
            <option value="General Idea">General Idea</option>
            <option value="Training & Timing">Training & Timing</option>
            <option value="Materials & Slides">Materials & Slides</option>
            <option value="Observations & Feedback">Observations & Feedback</option>
            <option value="Student Support">Student Support</option>
          </select>

          <textarea
            rows={3}
            required
            maxLength={1000}
            value={sugMessage}
            onChange={(e) => setSugMessage(e.target.value)}
            placeholder="Share an honest suggestion, concern, or improvement idea anonymously..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {sugError ? (
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {sugError}
              </span>
            ) : sugDone ? (
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Sent anonymously! Thank you for helping make YAO better.
              </span>
            ) : (
              <span className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Please do not include student names or phone numbers.
              </span>
            )}
            <button
              type="submit"
              disabled={sendingSug || !sugMessage.trim()}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-sm font-semibold disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sendingSug ? 'Sending...' : 'Send anonymously'}
            </button>
          </div>
        </form>

        {/* Admin-only Inbox so Tr Hein & Founder can immediately read anonymous messages here too */}
        {isAdmin && (
          <div className="pt-5 border-t border-[#E5D9EC] dark:border-[#332442] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#3B1050] dark:text-[#E8D5F5] flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#A8567F]" />
                Received Anonymous Messages ({suggestions.length})
              </h3>
              <span className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Admin-only view (also in Admin → Surveys & Box)
              </span>
            </div>

            {suggestions.length === 0 ? (
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                No anonymous messages received yet. Any teacher’s anonymous submission will appear
                here right away without their name or email.
              </p>
            ) : (
              <div className="space-y-2.5">
                {suggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {sug.category}
                      </p>
                      <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9] leading-relaxed">
                        {sug.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleArchiveSuggestion(sug.id)}
                      className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 self-start"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
