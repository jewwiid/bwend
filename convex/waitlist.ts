import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: { email: v.string() },
  returns: v.id("waitlist"),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("waitlist", {
      email,
      createdAt: Date.now(),
    });
  },
});
