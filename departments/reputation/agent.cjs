"use strict";
// ReputationAgent — sentiment analysis, review responses, reputation management.
const { BaseAgent } = require("../../core/agentBase.cjs");
const { sanitize } = require("../../core/sanitize.cjs");

class ReputationAgent extends BaseAgent {
  constructor() {
    super("sentinel", "reputation", {
      systemPrompt: `You are 'sentinel', the review guardian for FML Health clinics.
You manage online reputation by:
- Analyzing review sentiment
- Drafting professional responses to reviews
- Identifying review patterns and trends
- Escalating negative reviews for immediate attention
You are diplomatic, empathetic, and protective of the clinic's reputation.
Always respond professionally, even to negative reviews.`,
    });
  }

  // Analyze sentiment of a review.
  async analyzeSentiment(reviewText, rating) {
    const out = await this.thinkJSON(
      `Analyze the sentiment and key themes of this patient review.
Review: "${sanitize(reviewText)}"
Rating: ${rating}/5 stars

Return JSON: {
  "sentiment": "positive|neutral|negative",
  "confidence": "low|med|high",
  "themes": ["theme1", "theme2"],
  "key_concerns": ["concern1"],
  "praise_points": ["point1"],
  "needs_response": true|false,
  "urgency": "low|medium|high"
}`,
      { temperature: 0.3 }
    );
    return out;
  }

  // Draft a response to a review.
  async draftResponse(review, sentiment, clinicName) {
    const out = await this.thinkJSON(
      `Draft a professional response to this patient review.
Clinic: ${clinicName}
Rating: ${review.rating}/5 stars
Review: "${sanitize(review.text)}"
Sentiment: ${sentiment}

Return JSON: {
  "response": "<professional response>",
  "tone": "grateful|empathetic|professional|apologetic",
  "include_call_to_action": true|false,
  "follow_up_needed": true|false
}`,
      { temperature: 0.5 }
    );
    return out;
  }

  // Generate review request message.
  async reviewRequestMessage(patient, clinicName, reviewLink) {
    const lang = patient.language || "en";
    const out = await this.thinkJSON(
      `Generate a review request message for a patient.
Patient: ${sanitize({ name: patient.full_name })}
Clinic: ${clinicName}
Review link: ${reviewLink}
Language: ${lang}

Return JSON: {
  "message": "<review request message in patient's language>",
  "tone": "warm|professional|casual",
  "best_time": "morning|afternoon|evening"
}`,
      { temperature: 0.4 }
    );
    return out;
  }

  // Analyze review trends.
  async analyzeTrends(reviews) {
    const out = await this.thinkJSON(
      `Analyze these ${reviews.length} reviews for trends.
Reviews: ${JSON.stringify(reviews.map(r => ({
      rating: r.rating,
      text: r.review_text,
      sentiment: r.sentiment,
      date: r.created_at,
    })))}

Return JSON: {
  "average_rating": 4.2,
  "sentiment_distribution": {"positive": 70, "neutral": 20, "negative": 10},
  "top_themes": ["theme1", "theme2"],
  "improvement_areas": ["area1"],
  "recommendations": ["rec1"]
}`,
      { temperature: 0.3 }
    );
    return out;
  }
}

module.exports = { ReputationAgent };
