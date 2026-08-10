import { ReplayClient } from "./replay-client";

export default async function TrajectoryReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReplayClient id={id} />;
}
