import twilio from "twilio";
import { incomingIdentity, ownedCallerId, voiceIdentity, type Assignment } from "./voice";

/**
 * Offline routing preparation only. HTTP webhooks must stay locked until a
 * transactional credit reservation implementation and native build are verified.
 * Never construct a reservation from webhook fields or other client input.
 */
export type ReservedCall = {
  id: string;
  customerId: string;
  direction: "incoming" | "outgoing";
  providerCallSid: string;
  ownedNumber: string;
  remoteNumber: string;
  maxSeconds: number;
  expiresAt: Date;
};

export type RoutingDecision = {
  allowed: boolean;
  reason: "authorized" | "invalid_request" | "not_owner" | "destination_blocked" | "reservation_required";
  twiml: string;
};

const e164 = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);
const callSid = (value: string) => /^CA[0-9a-f]{32}$/i.test(value);

function reject(reason: RoutingDecision["reason"]): RoutingDecision {
  const response = new twilio.twiml.VoiceResponse();
  response.reject({ reason: "rejected" });
  return { allowed: false, reason, twiml: response.toString() };
}

function reservationMatches(
  reservation: ReservedCall | null,
  expected: Pick<ReservedCall, "customerId" | "direction" | "providerCallSid" | "ownedNumber" | "remoteNumber">,
  now: Date,
): reservation is ReservedCall {
  return Boolean(
    reservation?.id &&
    reservation.customerId === expected.customerId &&
    reservation.direction === expected.direction &&
    reservation.providerCallSid === expected.providerCallSid &&
    reservation.ownedNumber === expected.ownedNumber &&
    reservation.remoteNumber === expected.remoteNumber &&
    Number.isInteger(reservation.maxSeconds) &&
    reservation.maxSeconds >= 1 &&
    reservation.maxSeconds <= 3600 &&
    Number.isFinite(now.getTime()) &&
    reservation.expiresAt.getTime() > now.getTime(),
  );
}

// Called only after validating the Twilio webhook signature and AccountSid.
// customerId and assignment must be resolved by the server, never the app.
export function prepareOutgoingRoute(input: {
  customerId: string;
  fromClient: string;
  ownedNumber: string;
  destination: string;
  providerCallSid: string;
  assignment: Assignment | null;
  destinationApproved: boolean;
  reservation: ReservedCall | null;
  now?: Date;
}): RoutingDecision {
  if (!input.customerId || !e164(input.destination) || !callSid(input.providerCallSid)) {
    return reject("invalid_request");
  }
  if (
    input.fromClient !== `client:${voiceIdentity(input.customerId)}` ||
    !ownedCallerId(input.customerId, input.ownedNumber, input.assignment)
  ) {
    return reject("not_owner");
  }
  // Country, premium-rate, emergency and trial-recipient restrictions belong
  // in the server's destination approval; no app-supplied country is trusted.
  if (!input.destinationApproved) return reject("destination_blocked");
  if (!reservationMatches(input.reservation, {
    customerId: input.customerId,
    direction: "outgoing",
    providerCallSid: input.providerCallSid,
    ownedNumber: input.ownedNumber,
    remoteNumber: input.destination,
  }, input.now ?? new Date())) return reject("reservation_required");

  const response = new twilio.twiml.VoiceResponse();
  response.dial({
    callerId: input.ownedNumber,
    answerOnBridge: true,
    timeout: 30,
    timeLimit: input.reservation.maxSeconds,
  }).number(input.destination);
  return { allowed: true, reason: "authorized", twiml: response.toString() };
}

export function prepareIncomingRoute(input: {
  ownedNumber: string;
  remoteNumber: string;
  providerCallSid: string;
  assignment: Assignment | null;
  reservation: ReservedCall | null;
  now?: Date;
}): RoutingDecision {
  if (!e164(input.ownedNumber) || !e164(input.remoteNumber) || !callSid(input.providerCallSid)) {
    return reject("invalid_request");
  }
  const identity = incomingIdentity(input.ownedNumber, input.assignment);
  if (!identity || !input.assignment) return reject("not_owner");
  if (!reservationMatches(input.reservation, {
    customerId: input.assignment.customerId,
    direction: "incoming",
    providerCallSid: input.providerCallSid,
    ownedNumber: input.ownedNumber,
    remoteNumber: input.remoteNumber,
  }, input.now ?? new Date())) return reject("reservation_required");

  const response = new twilio.twiml.VoiceResponse();
  response.dial({
    answerOnBridge: true,
    timeout: 30,
    timeLimit: input.reservation.maxSeconds,
  }).client(identity);
  return { allowed: true, reason: "authorized", twiml: response.toString() };
}
