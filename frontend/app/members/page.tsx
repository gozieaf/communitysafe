"use client";

import { useEffect, useState } from "react";
import { getMembers } from "../../lib/api-client";

export default function MembersPage() {
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getMembers>>>([]);
  useEffect(() => { void getMembers().then(setMembers); }, []);
  return <main style={{ margin: "2rem auto", maxWidth: 720, padding: "0 1.5rem" }}><h1>Members</h1>{members.map((member) => <article key={member.username}><h2>{member.username}</h2><p>Joined: {new Date(member.created_at).toLocaleDateString()}</p><p>{member.is_verified ? "Verified" : "Not verified"}</p>{member.email && <p>{member.email}</p>}</article>)}<p><a href="/">Back to map</a></p></main>;
}