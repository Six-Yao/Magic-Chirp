import { LogIn, LogOut, Settings, UserRound } from 'lucide-react';
import type { AuthState } from '../types/models';
import DrawerShell from './DrawerShell';

function SettingsDrawer({
  open,
  auth,
  onClose,
  onLogin,
  onLogout,
}: {
  open: boolean;
  auth: AuthState;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const user = auth.status === 'authenticated' ? auth.user : null;

  return (
    <DrawerShell open={open} title="设置" onClose={onClose}>
      <div className="settings-panel">
        <section className="settings-card">
          <Settings size={28} />
          <div>
            <h3>Magic-Chirp</h3>
            <p>像素校园观鸟手账</p>
          </div>
        </section>

        <section className="settings-card">
          <UserRound size={28} />
          <div>
            <h3>{user ? user.nickname : '游客模式'}</h3>
            <p>{user ? user.email : '登录后可以创建记录和查看我的页面'}</p>
          </div>
        </section>

        {user ? (
          <button className="settings-action danger" type="button" onClick={onLogout}>
            <LogOut size={18} />
            退出登录
          </button>
        ) : (
          <button className="settings-action" type="button" onClick={onLogin}>
            <LogIn size={18} />
            登录 / 注册
          </button>
        )}
      </div>
    </DrawerShell>
  );
}

export default SettingsDrawer;
