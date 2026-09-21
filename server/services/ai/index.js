const OpenAIProvider = require('./providers/openai');

/**
 * AIService - the single entry point for all AI operations.
 * The rest of the application should only ever depend on this class,
 * never on a specific provider.
 *
 * To swap providers, add a new provider class and return it from getProvider().
 */
class AIService {
  constructor() {
    this.provider = null;
  }

  getProvider() {
    if (this.provider) return this.provider;
    const providerName = (process.env.AI_PROVIDER || 'openai').toLowerCase();

    switch (providerName) {
      case 'openai':
      case 'openrouter':
        this.provider = new OpenAIProvider();
        break;
      default:
        this.provider = new OpenAIProvider();
    }
    return this.provider;
  }

  async generate(payload) {
    return this.getProvider().generate(payload);
  }

  // ---- Higher-level helpers ----

  async chat({ system, messages }) {
    return this.generate({ system, messages, maxTokens: 1500 });
  }

  async summarize(noteContent, length = 'medium') {
    const lengthGuide = {
      short: 'Be concise: 3-4 bullet points only.',
      medium: 'Provide a balanced summary with an overview and key concepts.',
      detailed: 'Provide a thorough, comprehensive summary.'
    };
    const system = `You are StudyPilot's note summarizer. Summarize the study note content provided.
Return ONLY valid JSON with this exact structure:
{
  "overview": "2-3 sentence overview",
  "keyConcepts": ["concept1", "concept2"],
  "importantPoints": ["point1", "point2"],
  "definitions": [{"term": "...", "definition": "..."}],
  "takeaways": ["takeaway1", "takeaway2"],
  "diagram": "Mermaid flowchart TD code OR null"
}
${lengthGuide[length] || lengthGuide.medium}
Keep arrays to 3-6 items each.
For "diagram": write a small Mermaid "flowchart TD" that visualizes how the topic's parts connect (a process, hierarchy, or flow). Use short node labels (a few words max) — no parentheses, quotes, or special characters inside labels that break Mermaid. IDs must be simple letters like A, B, C. Example:
flowchart TD
    A[Concept] --> B[Sub-topic]
    B --> C{Question}
    C -- Yes --> D[Result]
If the note has no meaningful structure to diagram, return null.`;
    const content = await this.generate({
      system,
      messages: [{ role: 'user', content: noteContent.slice(0, 30000) }],
      json: true,
      maxTokens: 2000
    });
    return this.parseJSON(content);
  }

  async generateQuiz({ content, numQuestions, difficulty, questionType }) {
    const typeInstruction = {
      'multiple-choice': 'All questions must be multiple choice with 4 options (A-D).',
      'true-false': 'All questions must be true/false.',
      'short-answer': 'All questions must be short answer (correctAnswer is the model answer).',
      mixed: 'Mix of question types: mostly multiple choice, with some true/false and short answer.'
    }[questionType] || 'Mix of question types.';

    const difficultyInstruction = {
      easy: 'Keep questions basic and recall-focused.',
      medium: 'Aim for a moderate level requiring understanding.',
      hard: 'Ask challenging, application-based questions.'
    }[difficulty] || 'Aim for a moderate level.';

    const system = `You are StudyPilot's quiz generator. Generate a study quiz from the provided content.
Return ONLY valid JSON with this exact structure:
{
  "title": "A short title",
  "questions": [
    {
      "type": "multiple-choice | true-false | short-answer",
      "question": "The question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "The correct option letter or text",
      "explanation": "A 1-2 sentence explanation",
      "topic": "A short topic label"
    }
  ]
}
${typeInstruction}
${difficultyInstruction}
For multiple-choice, options must be exactly 4 items and correctAnswer must be the letter (A, B, C, or D).
For true-false, correctAnswer must be "True" or "False".
Generate exactly ${numQuestions} questions.`;

    const aiContent = await this.generate({
      system,
      messages: [{ role: 'user', content: content.slice(0, 40000) }],
      json: true,
      maxTokens: 3000
    });
    return this.parseJSON(aiContent);
  }

  async explain({ question, context }) {
    const system = `You are StudyPilot's AI study assistant, helping a student understand their material.
Answer the student's question clearly and helpfully. If study context is provided, base your answer on that context where relevant.
Use markdown formatting. Be concise but complete. Use code blocks when showing code.`;
    const messages = [];
    if (context) {
      messages.push({
        role: 'user',
        content: `Here is my study material to reference:\n\n"""\n${context.slice(0, 30000)}\n"""`
      });
    }
    messages.push({ role: 'user', content: question });
    return this.generate({ system, messages, maxTokens: 1200 });
  }

  async recommend({ stats }) {
    const system = `You are StudyPilot's study advisor. Based on the user's real study data, produce 3-5 actionable, specific recommendations.
Do NOT give generic motivational advice. Each recommendation must reference the actual data provided (subject names, tasks, quiz scores, study times).
Return ONLY valid JSON:
{
  "recommendations": [
    { "title": "Short actionable title", "detail": "Specific, actionable 1-2 sentence detail" }
  ]
}`;
    const content = await this.generate({
      system,
      messages: [{ role: 'user', content: JSON.stringify(stats) }],
      json: true,
      maxTokens: 1500
    });
    const parsed = this.parseJSON(content);
    return Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [];
  }

  parseJSON(content) {
    try {
      // Try direct parse first
      return JSON.parse(content);
    } catch (e) {
      // Strip markdown code fences if present
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        return JSON.parse(match[1]);
      }
      // Try to extract the first JSON object
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        return JSON.parse(content.slice(start, end + 1));
      }
      throw new Error('AI returned invalid JSON response');
    }
  }

  /**
   * Cleans up Mermaid code string by removing markdown code fences and trimming.
   * @param {string|null} code - Raw Mermaid code string from AI
   * @returns {string|null} Cleaned Mermaid code or null if empty/invalid
   */
  cleanMermaidCode(code) {
    if (typeof code !== 'string') return null;
    // Trim whitespace
    code = code.trim();
    // Remove starting and ending triple backticks if present
    if (code.startsWith('```') && code.endsWith('```')) {
      // Extract the content between the backticks, but note there might be a language specifier after the first ```
      const lines = code.split('\n');
      // Remove the first line if it starts with ```
      if (lines[0].trim().startsWith('```')) {
        lines.shift();
      }
      // Remove the last line if it ends with ```
      if (lines.length > 0 && lines[lines.length-1].trim().endsWith('```')) {
        lines.pop();
      }
      code = lines.join('\n').trim();
    }
    // If the code is empty, return null
    return code.length > 0 ? code : null;
  }
}

module.exports = new AIService();
