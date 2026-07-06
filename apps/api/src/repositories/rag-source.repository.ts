import type { Citation } from "@hhh/contracts";
import { pool } from "../database/pool.js";

export interface StoreWebSearchSourcesInput {
  promptLogId: string;
  citations: Citation[];
}

type RagDocumentRow = {
  id: string;
};

export class RagSourceRepository {
  async storeWebSearchSources(input: StoreWebSearchSourcesInput) {
    const citations = input.citations.filter((citation) => citation.citedText?.trim());
    let chunksCreated = 0;
    const documentIds = new Set<string>();

    for (const [index, citation] of citations.entries()) {
      const documentId = await this.upsertDocument({
        title: citation.title ?? citation.url,
        url: citation.url,
        promptLogId: input.promptLogId
      });
      documentIds.add(documentId);

      await this.appendChunk({
        documentId,
        content: citation.citedText!.trim(),
        promptLogId: input.promptLogId,
        citationIndex: index,
        sourceUrl: citation.url
      });
      chunksCreated += 1;
    }

    return {
      documentsTouched: documentIds.size,
      chunksCreated
    };
  }

  private async upsertDocument(input: { title: string; url: string; promptLogId: string }) {
    const { rows } = await pool.query<RagDocumentRow>(
      `
        insert into rag_documents (title, source_uri, metadata)
        values ($1, $2, $3)
        on conflict (source_uri)
        where source_uri is not null
        do update set
          title = excluded.title,
          metadata = rag_documents.metadata || excluded.metadata,
          updated_at = now()
        returning id
      `,
      [
        input.title,
        input.url,
        {
          source: "web_search",
          lastPromptLogId: input.promptLogId
        }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Expected RAG document row was not returned.");
    }

    return row.id;
  }

  private async appendChunk(input: {
    documentId: string;
    content: string;
    promptLogId: string;
    citationIndex: number;
    sourceUrl: string;
  }) {
    await pool.query(
      `
        insert into rag_chunks (document_id, chunk_index, content, metadata)
        values (
          $1,
          coalesce((select max(chunk_index) + 1 from rag_chunks where document_id = $1), 0),
          $2,
          $3
        )
      `,
      [
        input.documentId,
        input.content,
        {
          source: "web_search",
          promptLogId: input.promptLogId,
          citationIndex: input.citationIndex,
          sourceUrl: input.sourceUrl
        }
      ]
    );
  }
}

export const ragSourceRepository = new RagSourceRepository();
