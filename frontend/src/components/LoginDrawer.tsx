import { useState } from 'react';
import { api } from '../api/client';
import DrawerShell from './DrawerShell';

function LoginDrawer({
  open,
  onClose,
  onLoginSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@smail.nju.edu.cn');
  const [password, setPassword] = useState('12345678');
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await api.register(email, password, nickname);
        setMode('login');
        setMessage('注册成功，请登录。');
      } else {
        const response = await api.login(email, password);
        onLoginSuccess(response.access_token);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DrawerShell open={open} title={mode === 'login' ? '登录啾啾账号' : '注册啾啾账号'} onClose={onClose}>
      <form className="drawer-form" onSubmit={submit}>
        <div className="segmented-control">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
            登录
          </button>
          <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>
            注册
          </button>
        </div>
        <label>
          邮箱
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {mode === 'register' && (
          <label>
            昵称
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
          </label>
        )}
        {message && <p className={message.includes('成功') ? 'drawer-note' : 'drawer-error'}>{message}</p>}
        <button className="primary-action" type="submit" disabled={submitting}>
          {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>
    </DrawerShell>
  );
}

export default LoginDrawer;
