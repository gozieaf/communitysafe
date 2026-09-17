import { LoginForm } from "../../components/auth/LoginForm";

export default function LoginPage() {
  return <main style={{ fontFamily: "system-ui, sans-serif", margin: "4rem auto", maxWidth: 720, padding: "0 1.5rem" }}>
    <h1>Admin sign in</h1>
    <LoginForm />
  </main>;
}
