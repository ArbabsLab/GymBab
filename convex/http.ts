import { httpRouter} from "convex/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { api } from "./_generated/api";
import {httpAction} from "./_generated/server"
import { GoogleGenAI } from "@google/genai";

const http = httpRouter()
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})
http.route({
    path:"/webhook",
    method:"POST",
    handler: httpAction(async (ctx, req) => {
        const whSecret = process.env.CLERK_WEBHOOK_SECRET;
        if (!whSecret) {
            throw new Error("missing webhook secret")
        }

        const svix_id = req.headers.get("svix-id");
        const svix_signature = req.headers.get("svix-signature");
        const svix_timestamp = req.headers.get("svix-timestamp");

        if (!svix_id || !svix_signature || !svix_timestamp) {
      return new Response("No svix headers found", {
        status: 400,
      });
    }

        const payload = await req.json();
        const body = JSON.stringify(payload)

        const wh = new Webhook(whSecret);
        let evt: WebhookEvent;

        try{
            evt = wh.verify(body, {
                "svix-id": svix_id,
                "svix-signature": svix_signature,
                "svix-timestamp": svix_timestamp,
            }) as WebhookEvent;

        } catch (e){
            console.error("verification of webhook failed", e);
            return new Response("Error occurred", {status: 400})
        }

        const eventType = evt.type;

        if(eventType == "user.created"){
            const {id, first_name, last_name, image_url, email_addresses} = evt.data;

            const email = email_addresses[0].email_address;
            const name = `${first_name || ""} ${last_name || ""}`.trim();

            try{
                await ctx.runMutation(api.users.syncUser, {
                    email,
                    name,
                    image: image_url,
                    clerkId: id
                })
            } catch (e){
                console.log("Error creating user");
                return new Response("Error occurred", {status: 500})
            }
        }

        if (eventType === "user.updated") {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;

        const email = email_addresses[0].email_address;
        const name = `${first_name || ""} ${last_name || ""}`.trim();

        try {
            await ctx.runMutation(api.users.updateUser, {
            clerkId: id,
            email,
            name,
            image: image_url,
            });
        } catch (error) {
            console.log("Error updating user:", error);
            return new Response("Error updating user", { status: 500 });
        }
        }

        return new Response("Processed", {status: 200});
    }),

});

function validateWorkoutPlan(plan: any) {
  const validatedPlan = {
    schedule: plan.schedule,
    exercises: plan.exercises.map((exercise: any) => ({
      day: exercise.day,
      routines: exercise.routines.map((routine: any) => ({
        name: routine.name,
        sets: typeof routine.sets === "number" ? routine.sets : parseInt(routine.sets) || 1,
        reps: typeof routine.reps === "number" ? routine.reps : parseInt(routine.reps) || 10,
      })),
    })),
  };
  return validatedPlan;
}


function validateDietPlan(plan: any) {
  const validatedPlan = {
    dailyCalories: plan.dailyCalories,
    meals: plan.meals.map((meal: any) => ({
      name: meal.name,
      foods: meal.foods,
    })),
  };
  return validatedPlan;
}



http.route({
  path: "/generate-routine",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const payload = await req.json();

      const {
        user_id,
        age,
        height,
        weight,
        injuries,
        workout_days,
        fitness_goal,
        fitness_level,
        dietary_restrictions,
      } = payload;

      // --- Workout prompt & Gemini call ---
      const workoutPrompt = `You are a fitness coach creating a personalized workout plan based on:
Age: ${age}
Height: ${height}
Weight: ${weight}
Injuries or limitations: ${injuries}
Available days for workout: ${workout_days}
Fitness goal: ${fitness_goal}
Fitness level: ${fitness_level}

As a professional coach:
- Consider muscle group splits to avoid overtraining the same muscles on consecutive days
- Design exercises that match the fitness level and account for any injuries
- Structure the workouts to specifically target the user's fitness goal

CRITICAL SCHEMA INSTRUCTIONS:
- Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
- "sets" and "reps" MUST be NUMBERS
- For example: "sets": 3, "reps": 10
- Use specific numbers like "reps": 12 or "reps": 15
- For cardio, use "sets": 1, "reps": 1 or another appropriate number
- NEVER include strings for numerical fields
- NEVER add extra fields not shown in the example below

Return a JSON object with this EXACT structure:
{
  "schedule": ["Monday", "Wednesday", "Friday"],
  "exercises": [
    {
      "day": "Monday",
      "routines": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10
        }
      ]
    }
  ]
}

DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

      const workoutResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: workoutPrompt,
        config: {
          temperature: 0.2,
          topP: 0.9,
          responseMimeType: "application/json",
          systemInstruction: workoutPrompt,
        },
      });
      console.log("Gemini raw workout:", workoutResponse.text);

      let workoutPlan;
      try {
        workoutPlan = validateWorkoutPlan(JSON.parse(workoutResponse.text || "{}"));
      } catch (e) {
        throw new Error("Invalid workout plan JSON from AI");
      }

      // --- Diet prompt & Gemini call ---
      const dietPrompt = `You are an experienced nutrition coach creating a personalized diet plan based on:
Age: ${age}
Height: ${height}
Weight: ${weight}
Fitness goal: ${fitness_goal}
Dietary restrictions: ${dietary_restrictions}

As a professional nutrition coach:
- Calculate appropriate daily calorie intake based on the person's stats and goals
- Create a balanced meal plan with proper macronutrient distribution
- Include a variety of nutrient-dense foods while respecting dietary restrictions
- Consider meal timing around workouts for optimal performance and recovery

CRITICAL SCHEMA INSTRUCTIONS:
- Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
- "dailyCalories" MUST be a NUMBER, not a string
- DO NOT add fields like "supplements", "macros", "notes", or ANYTHING else
- ONLY include the EXACT fields shown in the example below
- Each meal should include ONLY a "name" and "foods" array

Return a JSON object with this EXACT structure and no other fields:
{
  "dailyCalories": 2000,
  "meals": [
    {
      "name": "Breakfast",
      "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
    },
    {
      "name": "Lunch",
      "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
    }
  ]
}

DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

      const dietResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: dietPrompt,
        config: {
          temperature: 0.2,
          topP: 0.9,
          responseMimeType: "application/json",
          systemInstruction: dietPrompt,
        },
      });
      console.log("Gemini raw diet:", dietResponse.text);

      let dietPlan;
      try {
        dietPlan = validateDietPlan(JSON.parse(dietResponse.text || "{}"));
      } catch (e) {
        throw new Error("Invalid diet plan JSON from AI");
      }

      // --- Save plan in DB ---
      const planId = await ctx.runMutation(api.plans.createPlan, {
        userId: user_id,
        dietPlan,
        isActive: true,
        workoutPlan,
        name: `${fitness_goal} Plan - ${new Date().toLocaleDateString()}`,
      });

      // --- Respond with CORS headers ---
      return new Response(
        JSON.stringify({
          success: true,
          data: { planId, workoutPlan, dietPlan },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    } catch (error) {
      console.error("Error generating fitness plan:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }
  }),
});



export default http;

