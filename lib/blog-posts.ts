// Blog posts data for SEO and AdSense approval
export interface BlogPost {
  slug: string;
  title: {
    ko: string;
    en: string;
  };
  excerpt: {
    ko: string;
    en: string;
  };
  content: {
    ko: string;
    en: string;
  };
  author: string;
  publishedAt: string;
  category: {
    ko: string;
    en: string;
  };
  tags: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'what-is-turtle-soup',
    title: {
      ko: '바다거북스프란 무엇인가? 추리 게임의 매력',
      en: 'What is Turtle Soup? The Charm of Deduction Games',
    },
    excerpt: {
      ko: '바다거북스프는 추리와 질문을 통해 진실을 밝혀내는 게임입니다. 이 게임의 기본 개념과 매력을 알아보세요.',
      en: 'Turtle Soup is a game where you uncover the truth through deduction and questions. Learn about the basic concepts and charm of this game.',
    },
    content: {
      ko: `# 바다거북스프란 무엇인가?

바다거북스프는 추리와 질문을 통해 진실을 밝혀내는 온라인 멀티플레이어 게임입니다. 이 게임은 한 명의 호스트가 이야기와 진실을 설정하고, 다른 플레이어들이 예/아니오/상관없음으로 답변 가능한 질문을 통해 진실을 추리하는 방식으로 진행됩니다.

## 게임의 기본 구조

게임은 크게 두 가지 모드로 나뉩니다:

1. **멀티플레이어 모드**: 호스트가 방을 만들고 다른 플레이어들이 참여하여 함께 추리하는 모드입니다.
2. **오프라인 모드**: 문제 목록에서 원하는 문제를 선택하여 혼자서 추리하는 모드입니다.

## 게임의 매력

바다거북스프의 가장 큰 매력은 논리적 사고력과 창의적 발상을 동시에 요구한다는 점입니다. 단순히 정답을 맞추는 것이 아니라, 질문을 통해 정보를 수집하고 논리적으로 추리하는 과정 자체가 게임의 핵심입니다.

또한 멀티플레이어 모드에서는 다른 플레이어들과 협력하며 함께 진실을 찾아가는 협동의 즐거움을 느낄 수 있습니다. 각 플레이어의 질문과 답변이 모두 힌트가 되므로, 팀워크가 중요합니다.

## 시작하기

바다거북스프를 시작하려면 먼저 계정을 만들거나 로그인해야 합니다. 그 후 방을 만들거나 기존 방에 참여하여 게임을 시작할 수 있습니다. 오프라인 모드를 원한다면 문제 목록에서 원하는 문제를 선택하면 됩니다.

지금 바로 바다거북스프를 시작해보세요!`,
      en: `# What is Turtle Soup?

Turtle Soup is an online multiplayer game where you uncover the truth through deduction and questions. In this game, one host sets up a story and truth, and other players deduce the truth through questions that can be answered with yes/no/irrelevant.

## Basic Game Structure

The game is divided into two main modes:

1. **Multiplayer Mode**: A mode where the host creates a room and other players join to solve mysteries together.
2. **Offline Mode**: A mode where you select a problem from the problem list and solve it alone.

## The Charm of the Game

The biggest charm of Turtle Soup is that it requires both logical thinking and creative ideas. The core of the game is not just guessing the answer, but the process of collecting information through questions and deducing logically.

In multiplayer mode, you can also enjoy the pleasure of cooperation as you work with other players to find the truth. Since each player's questions and answers become hints, teamwork is important.

## Getting Started

To start playing Turtle Soup, you first need to create an account or log in. Then you can create a room or join an existing room to start the game. If you prefer offline mode, you can select a problem from the problem list.

Start playing Turtle Soup now!`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-15',
    category: {
      ko: '게임 소개',
      en: 'Game Introduction',
    },
    tags: ['게임 소개', '추리 게임', '바다거북스프'],
  },
  {
    slug: 'how-to-create-problems',
    title: {
      ko: '나만의 추리 문제 만들기 가이드',
      en: 'Guide to Creating Your Own Deduction Problems',
    },
    excerpt: {
      ko: '바다거북스프에서 자신만의 추리 문제를 만드는 방법을 단계별로 알아보세요.',
      en: 'Learn step-by-step how to create your own deduction problems in Turtle Soup.',
    },
    content: {
      ko: `# 나만의 추리 문제 만들기 가이드

바다거북스프에서 자신만의 추리 문제를 만들어 다른 플레이어들과 공유할 수 있습니다. 좋은 문제를 만드는 방법을 알아보세요.

## 문제 만들기의 기본

좋은 추리 문제는 다음 요소들을 포함해야 합니다:

1. **명확한 이야기**: 문제의 배경과 상황이 명확해야 합니다.
2. **논리적 추리 가능**: 질문을 통해 논리적으로 추리할 수 있어야 합니다.
3. **적절한 난이도**: 너무 쉬우면 재미없고, 너무 어려우면 포기하게 됩니다.

## 문제 작성 팁

- **구체적인 상황 설정**: 추상적인 이야기보다는 구체적인 상황을 설정하는 것이 좋습니다.
- **힌트 배치**: 모든 정보를 한 번에 주지 말고, 질문을 통해 단계적으로 알아낼 수 있도록 힌트를 배치하세요.
- **정답의 논리성**: 정답이 논리적으로 타당해야 합니다. 억지스러운 정답은 플레이어들을 실망시킵니다.

## 문제 공유하기

문제를 만들었다면 다른 플레이어들과 공유하세요. 좋은 문제는 많은 좋아요와 댓글을 받을 수 있습니다.`,
      en: `# Guide to Creating Your Own Deduction Problems

In Turtle Soup, you can create your own deduction problems and share them with other players. Learn how to create good problems.

## Basics of Problem Creation

A good deduction problem should include the following elements:

1. **Clear Story**: The background and situation of the problem should be clear.
2. **Logical Deduction Possible**: It should be possible to deduce logically through questions.
3. **Appropriate Difficulty**: If it's too easy, it's not fun, and if it's too hard, players will give up.

## Problem Writing Tips

- **Set Specific Situations**: It's better to set specific situations rather than abstract stories.
- **Place Hints**: Don't give all information at once, but place hints so that players can find out step by step through questions.
- **Logical Answer**: The answer must be logically valid. Forced answers disappoint players.

## Sharing Problems

Once you've created a problem, share it with other players. Good problems can receive many likes and comments.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-16',
    category: {
      ko: '가이드',
      en: 'Guide',
    },
    tags: ['문제 만들기', '가이드', '팁'],
  },
  {
    slug: 'multiplayer-strategies',
    title: {
      ko: '멀티플레이어 모드 전략 가이드',
      en: 'Multiplayer Mode Strategy Guide',
    },
    excerpt: {
      ko: '멀티플레이어 모드에서 승리하기 위한 효과적인 전략을 알아보세요.',
      en: 'Learn effective strategies to win in multiplayer mode.',
    },
    content: {
      ko: `# 멀티플레이어 모드 전략 가이드

멀티플레이어 모드에서 승리하기 위해서는 효과적인 질문 전략이 필요합니다.

## 질문 전략

1. **구체적인 질문**: 모호한 질문보다는 구체적이고 명확한 질문을 하세요.
2. **단계적 접근**: 큰 질문보다는 작은 질문들을 단계적으로 모아가세요.
3. **다른 플레이어 관찰**: 다른 플레이어들의 질문과 답변을 주의 깊게 관찰하세요.

## 협력의 중요성

멀티플레이어 모드에서는 팀워크가 중요합니다. 각 플레이어의 질문이 모두 힌트가 되므로, 서로의 질문을 공유하고 논의하는 것이 승리의 열쇠입니다.`,
      en: `# Multiplayer Mode Strategy Guide

To win in multiplayer mode, you need an effective questioning strategy.

## Questioning Strategy

1. **Specific Questions**: Ask specific and clear questions rather than vague ones.
2. **Step-by-Step Approach**: Collect small questions step by step rather than big questions.
3. **Observe Other Players**: Pay close attention to other players' questions and answers.

## Importance of Cooperation

Teamwork is important in multiplayer mode. Since each player's questions become hints, sharing and discussing each other's questions is the key to victory.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-17',
    category: {
      ko: '전략',
      en: 'Strategy',
    },
    tags: ['멀티플레이어', '전략', '팁'],
  },
  {
    slug: 'ranking-system-explained',
    title: {
      ko: '랭킹 시스템 완벽 가이드',
      en: 'Complete Guide to Ranking System',
    },
    excerpt: {
      ko: '바다거북스프의 랭킹 시스템이 어떻게 작동하는지 알아보세요.',
      en: 'Learn how Turtle Soup's ranking system works.',
    },
    content: {
      ko: `# 랭킹 시스템 완벽 가이드

바다거북스프의 랭킹 시스템은 문제 해결 수와 받은 좋아요 수를 기반으로 결정됩니다.

## 랭킹 요소

1. **문제 해결 수**: 더 많은 문제를 해결할수록 높은 순위를 기록할 수 있습니다.
2. **좋아요 수**: 다른 플레이어들로부터 받은 좋아요도 랭킹에 영향을 줍니다.

## 랭킹 올리기

랭킹을 올리려면:
- 다양한 문제를 해결하세요
- 좋은 문제를 만들어 공유하세요
- 다른 플레이어들의 문제에 좋아요를 주세요`,
      en: `# Complete Guide to Ranking System

Turtle Soup's ranking system is determined based on the number of problems solved and likes received.

## Ranking Factors

1. **Number of Problems Solved**: The more problems you solve, the higher your rank.
2. **Number of Likes**: Likes received from other players also affect your ranking.

## Raising Your Rank

To raise your rank:
- Solve various problems
- Create and share good problems
- Give likes to other players' problems`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-18',
    category: {
      ko: '시스템',
      en: 'System',
    },
    tags: ['랭킹', '시스템', '가이드'],
  },
  {
    slug: 'best-practices-for-hosts',
    title: {
      ko: '호스트가 되기 위한 베스트 프랙티스',
      en: 'Best Practices for Becoming a Host',
    },
    excerpt: {
      ko: '멀티플레이어 모드에서 좋은 호스트가 되는 방법을 알아보세요.',
      en: 'Learn how to be a good host in multiplayer mode.',
    },
    content: {
      ko: `# 호스트가 되기 위한 베스트 프랙티스

호스트는 게임의 핵심입니다. 좋은 호스트가 되기 위한 팁을 알아보세요.

## 호스트의 역할

1. **명확한 답변**: 플레이어들의 질문에 명확하고 정확하게 답변하세요.
2. **공정한 진행**: 모든 플레이어에게 공정하게 게임을 진행하세요.
3. **적절한 힌트**: 필요시 적절한 힌트를 제공하세요.`,
      en: `# Best Practices for Becoming a Host

The host is the core of the game. Learn tips to become a good host.

## Host's Role

1. **Clear Answers**: Answer players' questions clearly and accurately.
2. **Fair Progress**: Conduct the game fairly for all players.
3. **Appropriate Hints**: Provide appropriate hints when necessary.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-19',
    category: {
      ko: '가이드',
      en: 'Guide',
    },
    tags: ['호스트', '가이드', '팁'],
  },
  {
    slug: 'community-guidelines',
    title: {
      ko: '커뮤니티 가이드라인',
      en: 'Community Guidelines',
    },
    excerpt: {
      ko: '바다거북스프 커뮤니티에서 지켜야 할 규칙을 알아보세요.',
      en: 'Learn the rules to follow in the Turtle Soup community.',
    },
    content: {
      ko: `# 커뮤니티 가이드라인

모든 플레이어가 즐겁게 게임을 즐기기 위해 지켜야 할 규칙입니다.

## 기본 규칙

1. **존중**: 다른 플레이어들을 존중하세요.
2. **정중한 언어**: 정중하고 예의 바른 언어를 사용하세요.
3. **스포일러 금지**: 문제의 정답을 직접적으로 공유하지 마세요.`,
      en: `# Community Guidelines

Rules to follow so all players can enjoy the game.

## Basic Rules

1. **Respect**: Respect other players.
2. **Polite Language**: Use polite and courteous language.
3. **No Spoilers**: Don't directly share the answer to problems.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-20',
    category: {
      ko: '정책',
      en: 'Policy',
    },
    tags: ['커뮤니티', '가이드라인', '규칙'],
  },
  {
    slug: 'difficulty-levels',
    title: {
      ko: '문제 난이도 이해하기',
      en: 'Understanding Problem Difficulty Levels',
    },
    excerpt: {
      ko: '바다거북스프의 문제 난이도 시스템을 알아보세요.',
      en: 'Learn about Turtle Soup's problem difficulty system.',
    },
    content: {
      ko: `# 문제 난이도 이해하기

바다거북스프의 문제는 쉬움, 보통, 어려움 세 가지 난이도로 분류됩니다.

## 난이도 기준

- **쉬움**: 초보자도 쉽게 해결할 수 있는 문제
- **보통**: 약간의 추리가 필요한 문제
- **어려움**: 깊은 사고와 논리가 필요한 문제

자신의 실력에 맞는 난이도의 문제를 선택하여 즐기세요!`,
      en: `# Understanding Problem Difficulty Levels

Turtle Soup problems are classified into three difficulty levels: easy, medium, and hard.

## Difficulty Criteria

- **Easy**: Problems that beginners can easily solve
- **Medium**: Problems that require some deduction
- **Hard**: Problems that require deep thinking and logic

Choose problems of a difficulty level that matches your skill and enjoy!`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-21',
    category: {
      ko: '가이드',
      en: 'Guide',
    },
    tags: ['난이도', '가이드', '시스템'],
  },
  {
    slug: 'tips-for-beginners',
    title: {
      ko: '초보자를 위한 추리 게임 팁',
      en: 'Deduction Game Tips for Beginners',
    },
    excerpt: {
      ko: '바다거북스프를 처음 시작하는 분들을 위한 유용한 팁을 모았습니다.',
      en: 'Useful tips for those just starting with Turtle Soup.',
    },
    content: {
      ko: `# 초보자를 위한 추리 게임 팁

바다거북스프를 처음 시작하는 분들을 위한 팁입니다.

## 시작하기

1. **오프라인 모드로 시작**: 먼저 오프라인 모드에서 문제를 풀어보며 게임 방식을 익히세요.
2. **쉬운 문제부터**: 쉬운 난이도의 문제부터 시작하여 점차 어려운 문제로 도전하세요.
3. **질문 연습**: 멀티플레이어 모드에서는 질문하는 방법을 연습하세요.`,
      en: `# Deduction Game Tips for Beginners

Tips for those just starting with Turtle Soup.

## Getting Started

1. **Start with Offline Mode**: First, learn the game mechanics by solving problems in offline mode.
2. **Start with Easy Problems**: Start with easy difficulty problems and gradually challenge harder ones.
3. **Practice Questioning**: In multiplayer mode, practice how to ask questions.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-22',
    category: {
      ko: '팁',
      en: 'Tips',
    },
    tags: ['초보자', '팁', '가이드'],
  },
  {
    slug: 'advanced-strategies',
    title: {
      ko: '고급 전략: 전문가가 되는 방법',
      en: 'Advanced Strategies: How to Become an Expert',
    },
    excerpt: {
      ko: '바다거북스프에서 전문가가 되기 위한 고급 전략을 알아보세요.',
      en: 'Learn advanced strategies to become an expert in Turtle Soup.',
    },
    content: {
      ko: `# 고급 전략: 전문가가 되는 방법

바다거북스프에서 전문가가 되기 위한 고급 전략입니다.

## 고급 기법

1. **논리적 사고 체계화**: 질문을 체계적으로 분류하고 분석하세요.
2. **패턴 인식**: 비슷한 문제들의 패턴을 인식하여 빠르게 해결하세요.
3. **창의적 발상**: 때로는 예상치 못한 각도에서 접근해야 합니다.`,
      en: `# Advanced Strategies: How to Become an Expert

Advanced strategies to become an expert in Turtle Soup.

## Advanced Techniques

1. **Systematize Logical Thinking**: Systematically categorize and analyze questions.
2. **Pattern Recognition**: Recognize patterns in similar problems to solve them quickly.
3. **Creative Thinking**: Sometimes you need to approach from an unexpected angle.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-23',
    category: {
      ko: '전략',
      en: 'Strategy',
    },
    tags: ['고급', '전략', '전문가'],
  },
  {
    slug: 'mobile-optimization',
    title: {
      ko: '모바일에서 최적의 게임 경험',
      en: 'Optimal Gaming Experience on Mobile',
    },
    excerpt: {
      ko: '모바일 기기에서 바다거북스프를 즐기는 최적의 방법을 알아보세요.',
      en: 'Learn the best way to enjoy Turtle Soup on mobile devices.',
    },
    content: {
      ko: `# 모바일에서 최적의 게임 경험

바다거북스프는 모바일 브라우저에서도 완벽하게 작동합니다.

## 모바일 최적화

- 반응형 디자인으로 모든 화면 크기에 최적화되어 있습니다.
- 터치 인터페이스로 편리하게 조작할 수 있습니다.
- 오프라인 모드도 모바일에서 완벽하게 작동합니다.`,
      en: `# Optimal Gaming Experience on Mobile

Turtle Soup works perfectly on mobile browsers.

## Mobile Optimization

- Optimized for all screen sizes with responsive design.
- Convenient operation with touch interface.
- Offline mode also works perfectly on mobile.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-24',
    category: {
      ko: '기술',
      en: 'Technology',
    },
    tags: ['모바일', '최적화', '기술'],
  },
  {
    slug: 'problem-solving-techniques',
    title: {
      ko: '효과적인 문제 해결 기법',
      en: 'Effective Problem-Solving Techniques',
    },
    excerpt: {
      ko: '바다거북스프 문제를 효과적으로 해결하는 기법을 알아보세요.',
      en: 'Learn techniques to effectively solve Turtle Soup problems.',
    },
    content: {
      ko: `# 효과적인 문제 해결 기법

바다거북스프 문제를 효과적으로 해결하는 기법입니다.

## 해결 기법

1. **정보 수집**: 먼저 문제에서 주어진 모든 정보를 수집하세요.
2. **가설 설정**: 수집한 정보를 바탕으로 가설을 설정하세요.
3. **검증**: 가설을 검증하고 필요시 수정하세요.`,
      en: `# Effective Problem-Solving Techniques

Techniques to effectively solve Turtle Soup problems.

## Solving Techniques

1. **Collect Information**: First, collect all information given in the problem.
2. **Set Hypotheses**: Set hypotheses based on the collected information.
3. **Verify**: Verify hypotheses and modify if necessary.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-25',
    category: {
      ko: '기법',
      en: 'Techniques',
    },
    tags: ['문제 해결', '기법', '팁'],
  },
  {
    slug: 'community-features',
    title: {
      ko: '커뮤니티 기능 활용하기',
      en: 'Using Community Features',
    },
    excerpt: {
      ko: '바다거북스프의 커뮤니티 기능을 최대한 활용하는 방법을 알아보세요.',
      en: 'Learn how to make the most of Turtle Soup's community features.',
    },
    content: {
      ko: `# 커뮤니티 기능 활용하기

바다거북스프의 다양한 커뮤니티 기능을 활용하세요.

## 커뮤니티 기능

- **댓글**: 문제에 댓글을 달아 다른 플레이어들과 소통하세요.
- **좋아요**: 좋은 문제에 좋아요를 눌러주세요.
- **공유**: 문제를 친구들과 공유하세요.`,
      en: `# Using Community Features

Make use of Turtle Soup's various community features.

## Community Features

- **Comments**: Leave comments on problems to communicate with other players.
- **Likes**: Give likes to good problems.
- **Share**: Share problems with friends.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-26',
    category: {
      ko: '커뮤니티',
      en: 'Community',
    },
    tags: ['커뮤니티', '기능', '가이드'],
  },
  {
    slug: 'game-updates-january-2025',
    title: {
      ko: '2025년 1월 업데이트 소식',
      en: 'January 2025 Update News',
    },
    excerpt: {
      ko: '바다거북스프의 최신 업데이트 소식을 확인하세요.',
      en: 'Check out the latest update news for Turtle Soup.',
    },
    content: {
      ko: `# 2025년 1월 업데이트 소식

바다거북스프의 최신 업데이트 내용을 소개합니다.

## 주요 업데이트

- 새로운 문제 추가
- UI 개선
- 성능 최적화
- 버그 수정

더 나은 게임 경험을 위해 계속 노력하겠습니다!`,
      en: `# January 2025 Update News

Introducing the latest update content for Turtle Soup.

## Major Updates

- New problems added
- UI improvements
- Performance optimization
- Bug fixes

We will continue to work hard for a better gaming experience!`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-27',
    category: {
      ko: '업데이트',
      en: 'Updates',
    },
    tags: ['업데이트', '소식', '뉴스'],
  },
  {
    slug: 'privacy-and-security',
    title: {
      ko: '개인정보 보호와 보안',
      en: 'Privacy and Security',
    },
    excerpt: {
      ko: '바다거북스프가 사용자의 개인정보를 어떻게 보호하는지 알아보세요.',
      en: 'Learn how Turtle Soup protects users' personal information.',
    },
    content: {
      ko: `# 개인정보 보호와 보안

바다거북스프는 사용자의 개인정보 보호를 최우선으로 생각합니다.

## 보안 조치

- 모든 데이터는 암호화되어 저장됩니다.
- 안전한 인증 시스템을 사용합니다.
- 정기적인 보안 점검을 실시합니다.

자세한 내용은 개인정보처리방침을 참고하세요.`,
      en: `# Privacy and Security

Turtle Soup prioritizes user privacy protection.

## Security Measures

- All data is stored encrypted.
- We use a secure authentication system.
- Regular security checks are conducted.

For more details, please refer to the Privacy Policy.`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-28',
    category: {
      ko: '보안',
      en: 'Security',
    },
    tags: ['개인정보', '보안', '정책'],
  },
  {
    slug: 'future-roadmap',
    title: {
      ko: '바다거북스프의 미래 로드맵',
      en: 'Turtle Soup Future Roadmap',
    },
    excerpt: {
      ko: '바다거북스프의 향후 개발 계획을 확인하세요.',
      en: 'Check out Turtle Soup's future development plans.',
    },
    content: {
      ko: `# 바다거북스프의 미래 로드맵

바다거북스프의 향후 개발 계획을 소개합니다.

## 계획된 기능

- 새로운 게임 모드 추가
- 소셜 기능 강화
- 모바일 앱 출시
- 다국어 지원 확대

사용자 여러분의 의견을 항상 환영합니다!`,
      en: `# Turtle Soup Future Roadmap

Introducing Turtle Soup's future development plans.

## Planned Features

- New game modes
- Enhanced social features
- Mobile app release
- Expanded multilingual support

We always welcome your feedback!`,
    },
    author: '퀴즈 천국 팀',
    publishedAt: '2025-01-29',
    category: {
      ko: '로드맵',
      en: 'Roadmap',
    },
    tags: ['로드맵', '계획', '미래'],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts;
}

