import { httpRouter} from "convex/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { api } from "./_generated/api";
import {httpAction} from "./_generated/server"
const http = httpRouter()

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

export default http;

