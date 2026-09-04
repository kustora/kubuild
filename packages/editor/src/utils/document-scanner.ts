import { Node, PageDocument } from '@kubuild/schema';

/**
 * Recursively scans a document Node tree and collects nodes matching a predicate.
 */
export function collectDocumentNodes(
  node: Node,
  predicate: (n: Node) => boolean,
  acc: Node[] = [],
): Node[] {
  if (predicate(node)) {
    acc.push(node);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectDocumentNodes(child, predicate, acc);
    }
  }
  return acc;
}

/**
 * Scans a document for modal or dialog nodes.
 */
export function collectDocumentModals(doc?: PageDocument): Array<{ id: string; label: string }> {
  if (!doc?.document) return [];
  const nodes = collectDocumentNodes(
    doc.document,
    (n) => n.type === 'modal' || n.type === 'dialog' || n.id.toLowerCase().includes('modal'),
  );
  return nodes.map((n) => ({
    id: n.id,
    label: (n.props?.title as string) || (n.props?.label as string) || `<${n.type}> #${n.id}`,
  }));
}

/**
 * Scans a document for form nodes.
 */
export function collectDocumentForms(doc?: PageDocument): Array<{ id: string; label: string }> {
  if (!doc?.document) return [];
  const nodes = collectDocumentNodes(
    doc.document,
    (n) => n.type === 'form' || n.id.toLowerCase().includes('form'),
  );
  return nodes.map((n) => ({
    id: n.id,
    label: (n.props?.name as string) || (n.props?.ariaLabel as string) || `<${n.type}> #${n.id}`,
  }));
}

/**
 * Scans a document for section/container anchor targets.
 */
export function collectDocumentAnchors(doc?: PageDocument): Array<{ id: string; label: string }> {
  if (!doc?.document) return [];
  const nodes = collectDocumentNodes(
    doc.document,
    (n) => n.type === 'section' || n.type === 'container' || Boolean(n.props?.id),
  );
  return nodes.map((n) => ({
    id: n.id,
    label: (n.props?.title as string) || (n.props?.heading as string) || `#${n.id} (${n.type})`,
  }));
}

/**
 * Collects input field names from form and input nodes in the document.
 */
export function collectDocumentFormFields(doc?: PageDocument): string[] {
  if (!doc?.document) return [];
  const fieldSet = new Set<string>();

  const inputNodes = collectDocumentNodes(
    doc.document,
    (n) =>
      ['input', 'textarea', 'select', 'checkbox', 'radio', 'switch'].includes(n.type) ||
      Boolean(n.props?.name) ||
      Boolean(n.props?.fieldName),
  );

  for (const node of inputNodes) {
    const fieldName =
      (node.props?.name as string) ||
      (node.props?.fieldName as string) ||
      (node.props?.key as string);
    if (fieldName && typeof fieldName === 'string' && fieldName.trim()) {
      fieldSet.add(fieldName.trim());
    } else if (node.id) {
      // Fallback: sanitized node ID (e.g. "input-email" -> "email")
      const cleanId = node.id.replace(/^(input|text|field|select|textarea)-/i, '');
      if (cleanId) fieldSet.add(cleanId);
    }
  }

  return Array.from(fieldSet);
}
