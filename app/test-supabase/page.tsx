"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSupabasePage() {
    const [result, setResult] = useState("Connecting...");

    useEffect(() => {
        async function testConnection() {
            const { error } = await supabase
                .from("projects")
                .select("id")
                .limit(1);

            setResult(
                error
                    ? `Connection/query failed: ${error.message}`
                    : "Supabase connection successful!"
            );
        }

        testConnection();
    }, []);

    return (
        <main className="p-8">
            <h1 className="text-xl font-bold">Supabase Connection Test</h1>
            <p className="mt-4">{result}</p>
        </main>
    );
}