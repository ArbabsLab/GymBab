<h1 align="center">GymBab: AI Fitness Routine Tool</h1>

<a href="https://gym-bab.vercel.app/">Link: https://gym-bab.vercel.app/</a>

- Tech stack: Next.js, React, Tailwind & Shadcn UI
- Database: Convex
- Authentication: Clerk
- LLM Integration: Gemini

## Motivation

Fitness is a huge part of my life and I often find myself unsure of what workouts to do depending on what my goals are at that certain moment. 
This application solves that problem by generating and organizing my routines based on what I set as my goals.

## Features

- **Gymbab AI Assistant**: Engage with Gymbab AI, a chatbot that asks you the right questions to deliver your personalized fitness plan
- **AI Generated Workout Plans**: Get personalized exercise routines based on your fitness level, injuries, and goals
- **Diet Generation**: Receive personalized meal plans accounting for your dietary preferences
- **User Authentication**: Sign in seamlessly with Clerk
- **Routines**: Create and view multiple fitness routines 
- **Responsive Design**: UI that works across multiple devices (Web recommended)

## Setup .env file

```js
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Vapi Voice AI
NEXT_PUBLIC_VAPI_WORKFLOW_ID=
NEXT_PUBLIC_VAPI_API_KEY=

# Convex Database
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
```

## Getting Started

1. Clone the repository
2. Install dependencies:

```shell
npm install
```

3. Set up your environment variables as shown above
4. Run the development server:

```shell
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment




