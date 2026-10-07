/**
 * Navigation-lag fix: /chess-school is a server redirect to /chess-school/classroom, and
 * without a loading boundary at this level Next.js can't prefetch or paint anything for the
 * School tab until that redirect and the classroom's data load finish. Re-using the
 * classroom's own skeleton gives the tap instant feedback and avoids a flash of a different shape.
 */
export { default } from "./classroom/loading";
