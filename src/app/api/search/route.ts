import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { sources } from 'next/dist/compiled/webpack/webpack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);
const openai = new OpenAI();

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MATCH_COUNT = 5;
const COMPLETION_MODEL = 'gpt-4o-mini';

export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        // Get embeddings for the query
        // Search query converts the query into a vector and then finds the most similar vectors in the database
        const embeddingResponse = await openai.embeddings.create({
            model : EMBEDDING_MODEL,
            input : query
        });

        // Find similar documents with vector search
        const { data: results, error } = await supabase.rpc('match_documents', {
            query_embedding: JSON.stringify(embeddingResponse.data[0].embedding),
            match_count: MATCH_COUNT
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Combine chunk results into context
        // Chunks used as context for answer
        const context = results?.map((result: any) => result.content).join('\n---\n') || '';   

        // Generate answer using LLM with context
        const completion = await openai.chat.completions.create({
            model: COMPLETION_MODEL,
            messages: [
                { 
                    role: 'system', 
                    content: 'You are a helpful assistant. Use the provided context to answer questions. If the answer is not in the context, say you do not know.' 
                },
                { 
                    role: 'user', 
                    content: `Context: ${context}\n\nQuestion: ${query}` 
                }
            ],
    });

    // Return the generated answer
    return NextResponse.json(
    { 
            answer: completion.choices[0].message.content,
            sources: results 
    });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}