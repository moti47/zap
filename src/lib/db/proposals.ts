import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";
import { NotSignedInError } from "@/lib/auth";

/**
 * Section 27 — market proposals.
 *
 * Normal users submit a proposal. An admin approves or rejects it.
 * Approval spawns a real `markets` row via the service-role client
 * (bypassing RLS because the proposer isn't an admin and can't directly
 * insert into `markets`).
 */

export interface ProposalInput {
  question: string;
  description: string;
  category_id: string;
  resolution_date: string; // ISO
  resolution_source: string;
  initial_yes_price: number; // 1..99
  hero_image_url?: string | null;
}

export async function submitProposal(input: ProposalInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new NotSignedInError();

  const { data, error } = await supabase
    .from("market_proposals")
    .insert({
      proposer_id: user.id,
      question: input.question,
      description: input.description,
      category_id: input.category_id,
      resolution_date: input.resolution_date,
      resolution_source: input.resolution_source,
      initial_yes_price: input.initial_yes_price,
      hero_image_url: input.hero_image_url ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listMyProposals() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("market_proposals")
    .select("*, category:categories(slug,name,color)")
    .eq("proposer_id", user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listPendingProposals() {
  await requireAdmin();
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("market_proposals")
    .select(
      "*, proposer:profiles!market_proposals_proposer_id_fkey(id,username,name,avatar_url), category:categories(id,slug,name,color)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function approveProposal(proposalId: string) {
  await requireAdmin();
  const svc = createServiceClient();
  const { data: prop, error: e1 } = await svc
    .from("market_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (e1) throw e1;
  if (!prop) throw new Error("Proposal not found");
  if (prop.status !== "pending") {
    throw new Error(`Proposal already ${prop.status}`);
  }

  // Create the market with the proposer as the creator so they retain
  // resolution rights once it closes.
  const { data: market, error: e2 } = await svc
    .from("markets")
    .insert({
      question: prop.question,
      description: prop.description,
      category_id: prop.category_id,
      resolution_date: prop.resolution_date,
      resolution_source: prop.resolution_source,
      creator_id: prop.proposer_id,
      yes_price: prop.initial_yes_price,
      no_price: 100 - prop.initial_yes_price,
      hero_image_url: prop.hero_image_url,
      creation_source: "proposal_approved",
      status: "open",
    })
    .select()
    .single();
  if (e2) throw e2;

  await svc
    .from("market_proposals")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      approved_market_id: market.id,
    })
    .eq("id", proposalId);

  // Notify proposer.
  await svc.from("notifications").insert({
    user_id: prop.proposer_id,
    type: "market_proposal_approved",
    payload: { proposal_id: proposalId, market_id: market.id },
    read: false,
  });

  return market;
}

export async function rejectProposal(proposalId: string, reason: string) {
  await requireAdmin();
  if (!reason.trim()) throw new Error("Reject reason required");
  const svc = createServiceClient();
  const { data: prop, error } = await svc
    .from("market_proposals")
    .update({
      status: "rejected",
      reject_reason: reason.trim(),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw error;
  if (!prop) throw new Error("Already reviewed");

  await svc.from("notifications").insert({
    user_id: prop.proposer_id,
    type: "market_proposal_rejected",
    payload: { proposal_id: proposalId, reason },
    read: false,
  });
  return prop;
}
