'use client';

import { useState } from 'react';

export function FeedbackButtons({ itemUrl }: { itemUrl: string }) {
  const [voted, setVoted] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const submitFeedback = async (vote: number) => {
    setLoading(true);
    try {
      // Use URL as a proxy for item_id (would need to look up actual item_id in production)
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_url: itemUrl, vote }),
      });
      if (response.ok) {
        setVoted(vote);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
    setLoading(false);
  };

  if (voted !== null) {
    return (
      <span className="text-xs text-gray-400">
        {voted === 1 ? '👍' : '👎'}
      </span>
    );
  }

  return (
    <div className="flex gap-1">
      <button
        onClick={() => submitFeedback(1)}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-green-600 disabled:opacity-50"
        title="Useful"
      >
        👍
      </button>
      <button
        onClick={() => submitFeedback(-1)}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
        title="Not useful"
      >
        👎
      </button>
    </div>
  );
}
