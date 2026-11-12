import { quizSchema, type Quiz } from './schema.ts'

/** Built-in quiz that anyone can play without an API key. */
export const demoQuiz: Quiz = quizSchema.parse({
  id: 'demo-solar-system',
  title: 'Our Solar System',
  source: { kind: 'demo', label: 'Demo quiz' },
  settings: { count: 8, difficulty: 'easy', types: ['multiple_choice', 'true_false'] },
  createdAt: '2026-11-03T00:00:00.000Z',
  questions: [
    {
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Which planet is closest to the Sun?',
      options: ['Venus', 'Mercury', 'Mars', 'Earth'],
      correctIndex: 1,
      explanation:
        'Mercury orbits closest to the Sun, at an average distance of about 58 million km.',
    },
    {
      id: 'q2',
      type: 'true_false',
      prompt:
        'Venus is the hottest planet in the solar system, even though Mercury is closer to the Sun.',
      answer: true,
      explanation:
        "Venus's thick carbon-dioxide atmosphere traps heat, keeping its surface around 465 °C, hotter than Mercury.",
    },
    {
      id: 'q3',
      type: 'multiple_choice',
      prompt: 'What is the largest planet in our solar system?',
      options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'],
      correctIndex: 2,
      explanation:
        'Jupiter is the largest planet: more than twice as massive as all the other planets combined.',
    },
    {
      id: 'q4',
      type: 'true_false',
      prompt: 'A day on Venus (one full spin) is longer than its year.',
      answer: true,
      explanation:
        'Venus takes about 243 Earth days to spin once, but only about 225 Earth days to orbit the Sun.',
    },
    {
      id: 'q5',
      type: 'multiple_choice',
      prompt: 'Which of these planets is famous for its bright, easily visible rings?',
      options: ['Mars', 'Venus', 'Mercury', 'Saturn'],
      correctIndex: 3,
      explanation:
        "All the giant planets have rings, but Saturn's are by far the brightest and largest, made mostly of ice.",
    },
    {
      id: 'q6',
      type: 'multiple_choice',
      prompt: 'Roughly how long does sunlight take to reach Earth?',
      options: ['8 seconds', '8 minutes', '8 hours', '8 days'],
      correctIndex: 1,
      explanation:
        'Light travels about 150 million km from the Sun to Earth in roughly 8 minutes and 20 seconds.',
    },
    {
      id: 'q7',
      type: 'true_false',
      prompt: 'Pluto is officially one of the eight planets.',
      answer: false,
      explanation:
        'In 2006 the International Astronomical Union reclassified Pluto as a dwarf planet.',
    },
    {
      id: 'q8',
      type: 'multiple_choice',
      prompt: 'Olympus Mons, the tallest known volcano in the solar system, is on which planet?',
      options: ['Earth', 'Mars', 'Venus', 'Mercury'],
      correctIndex: 1,
      explanation:
        'Olympus Mons on Mars rises about 22 km, roughly two and a half times the height of Mount Everest.',
    },
  ],
})
