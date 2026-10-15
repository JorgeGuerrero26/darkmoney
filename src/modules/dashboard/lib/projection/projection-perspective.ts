/** The stored direction belongs to the owner, not the invited viewer. */
export function obligationViewerDirection(obligation: { direction?: string }): "receivable" | "payable" {
  const shared = "viewerMode" in obligation;
  return obligation.direction === "receivable"
    ? shared ? "payable" : "receivable"
    : shared ? "receivable" : "payable";
}
