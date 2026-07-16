'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import dynamic from 'next/dynamic';

const AttachmentModal = dynamic(() => import('@/components/dashboard/AttachmentModal'), {
  ssr: false,
});
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Globe, 
  LogOut, 
  FolderKanban, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Edit3, 
  UserPlus, 
  AlertTriangle,
  Building,
  UserCheck,
  Search,
  Filter,
  ArrowUpDown,
  Archive,
  RotateCcw,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ListTodo,
  Bell,
  BellOff,
  Users,
  Paperclip
} from 'lucide-react';
import api from '@/lib/axios';
import { getSocket } from '@/lib/socket';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

type TabType = 'overview' | 'projects' | 'tasks' | 'organization';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  members: ProjectMember[];
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  projectId: string;
  project: { id: string; name: string };
  assignedUserId: string | null;
  assignedUser: { id: string; name: string; email: string } | null;
  creator: { id: string; name: string; email: string };
  createdAt: string;
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  profileImage?: string | null;
  createdAt: string;
}

interface DashboardStats {
  projects: {
    total: number;
    active: number;
    archived: number;
  };
  tasks: {
    total: number;
    statusCounts: {
      TODO: number;
      IN_PROGRESS: number;
      REVIEW: number;
      DONE: number;
    };
    priorityCounts: {
      LOW: number;
      MEDIUM: number;
      HIGH: number;
    };
  };
  progressPercentage: number;
  recentActivities: Array<{
    id: string;
    type: string;
    message: string;
    time: string;
  }>;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: string | null;
  createdAt: string;
}

interface Attachment {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

function getErrorMessage(err: unknown, defaultMessage: string): string {
  const errorData = err as { response?: { data?: { message?: string } } };
  return errorData.response?.data?.message || defaultMessage;
}

function DashboardContent() {
  const { user, logout, setUser } = useAuthStore();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Database Data & Filters
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Project Query Params
  const [projSearch, setProjSearch] = useState('');
  const [projArchived, setProjArchived] = useState(false);
  const [projPage, setProjPage] = useState(1);
  const [projLimit] = useState(6);
  const [projSortBy, setProjSortBy] = useState<'newest' | 'oldest' | 'alphabetical'>('newest');
  const [projPagination, setProjPagination] = useState<PaginationMeta>({ total: 0, page: 1, limit: 6, totalPages: 1 });

  // Task Query Params
  const [taskSearch, setTaskSearch] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [taskPage, setTaskPage] = useState(1);
  const [taskLimit] = useState(6);
  const [taskSortBy, setTaskSortBy] = useState<'newest' | 'oldest' | 'priority' | 'dueDate'>('newest');
  const [taskPagination, setTaskPagination] = useState<PaginationMeta>({ total: 0, page: 1, limit: 6, totalPages: 1 });

  // Real-time states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // File attachments state variables
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentModal, setAttachmentModal] = useState<{ open: boolean; projectId?: string; taskId?: string; title: string }>({
    open: false,
    title: '',
  });

  // States
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [projectModal, setProjectModal] = useState<{ open: boolean; editId?: string; name: string; description: string; memberIds: string[] }>({
    open: false,
    name: '',
    description: '',
    memberIds: []
  });

  const [taskModal, setTaskModal] = useState<{ open: boolean; editId?: string; title: string; description: string; projectId: string; assignedUserId: string; status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'; priority: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate: string }>({
    open: false,
    title: '',
    description: '',
    projectId: '',
    assignedUserId: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: ''
  });

  const [memberModal, setMemberModal] = useState({
    open: false,
    name: '',
    email: '',
    password: '',
    role: 'MEMBER' as 'ADMIN' | 'MEMBER'
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
    }
  };

  // Fetch Stats (for Overview tab)
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data.notifications);
      const unread = (res.data.data.notifications as Notification[]).filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Attachments list
  const fetchAttachments = useCallback(async (projId?: string, tId?: string) => {
    setAttachmentsLoading(true);
    try {
      let query = '';
      if (projId) query = `projectId=${projId}`;
      if (tId) query = `taskId=${tId}`;
      const res = await api.get(`/uploads/attachments?${query}`);
      setAttachments(res.data.data.attachments);
    } catch (err) {
      console.error(err);
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  // Fetch attachments list when attachment modal is opened
  useEffect(() => {
    if (attachmentModal.open && (attachmentModal.projectId || attachmentModal.taskId)) {
      fetchAttachments(attachmentModal.projectId, attachmentModal.taskId);
    }
  }, [attachmentModal.open, attachmentModal.projectId, attachmentModal.taskId, fetchAttachments]);

  // API Call wrappers
  const fetchData = useCallback(async (tab: TabType) => {
    if (!user) return;
    setLoading(true);
    try {
      await fetchNotifications();

      const mRes = await api.get('/members');
      setMembers(mRes.data.data.members);

      if (tab === 'overview') {
        await fetchStats();
      } else if (tab === 'projects') {
        const query = `search=${encodeURIComponent(projSearch)}&archived=${projArchived}&page=${projPage}&limit=${projLimit}&sortBy=${projSortBy}`;
        const res = await api.get(`/projects?${query}`);
        setProjects(res.data.data.projects);
        setProjPagination(res.data.data.pagination);
      } else if (tab === 'tasks') {
        let query = `search=${encodeURIComponent(taskSearch)}&page=${taskPage}&limit=${taskLimit}&sortBy=${taskSortBy}`;
        if (taskProjectId) query += `&projectId=${taskProjectId}`;
        if (taskStatus) query += `&status=${taskStatus}`;
        if (taskPriority) query += `&priority=${taskPriority}`;

        const res = await api.get(`/tasks?${query}`);
        setTasks(res.data.data.tasks);
        setTaskPagination(res.data.data.pagination);

        const pRes = await api.get('/projects?limit=100');
        setProjects(pRes.data.data.projects);
      } else if (tab === 'organization') {
        if (user.role === 'MEMBER') {
          setActiveTab('overview');
        }
      }
    } catch (err) {
      console.error(err);
      showToast(getErrorMessage(err, 'Error fetching data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, projSearch, projArchived, projPage, projLimit, projSortBy, taskSearch, taskProjectId, taskStatus, taskPriority, taskPage, taskLimit, taskSortBy, fetchStats, fetchNotifications]);

  // Initial Fetch & Tab-specific bindings
  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  // Socket.IO Realtime Listeners
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    socket.connect();

    socket.on('PRESENCE_CHANGE', (data: { onlineUserIds: string[] }) => {
      setOnlineUserIds(data.onlineUserIds);
    });

    socket.on('NEW_NOTIFICATION', (data: { notification: Notification; userId: string }) => {
      if (data.userId === user.id) {
        showToast(`🔔 ${data.notification.title}: ${data.notification.message}`);
        setNotifications((prev) => [data.notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    });

    socket.on('NEW_ACTIVITY', (log: { id: string; type: string; message: string; createdAt: string }) => {
      setStats((prev) => {
        if (!prev) return null;
        const newAct = { id: log.id, type: log.type, message: log.message, time: log.createdAt };
        return {
          ...prev,
          recentActivities: [newAct, ...prev.recentActivities].slice(0, 10),
        };
      });
    });

    socket.on('PROJECT_CHANGE', () => {
      fetchData(activeTab);
      fetchStats();
    });

    socket.on('TASK_CHANGE', () => {
      fetchData(activeTab);
      fetchStats();
    });

    socket.on('ROSTER_CHANGE', () => {
      fetchData(activeTab);
    });

    socket.on('STATS_REFRESH', () => {
      fetchStats();
    });

    return () => {
      socket.off('PRESENCE_CHANGE');
      socket.off('NEW_NOTIFICATION');
      socket.off('NEW_ACTIVITY');
      socket.off('PROJECT_CHANGE');
      socket.off('TASK_CHANGE');
      socket.off('ROSTER_CHANGE');
      socket.off('STATS_REFRESH');
      socket.disconnect();
    };
  }, [user, activeTab, fetchData, fetchStats]);

  // Profile Image Upload Trigger
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Profile image must be less than 2MB', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadProgress(15);
    try {
      const res = await api.post('/uploads/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadProgress(percent);
        },
      });
      // Update global auth store with new profile image url
      setUser(res.data.data.user);
      showToast('Profile avatar updated successfully!');
      
      // Update roster list
      fetchData(activeTab);
    } catch (err) {
      showToast(getErrorMessage(err, 'Error uploading profile image'), 'error');
    } finally {
      setUploadProgress(0);
    }
  };

  // Upload Attachment Document Trigger
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Attachments must be less than 10MB', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (attachmentModal.projectId) {
      formData.append('projectId', attachmentModal.projectId);
    }
    if (attachmentModal.taskId) {
      formData.append('taskId', attachmentModal.taskId);
    }

    setUploadProgress(10);
    try {
      await api.post('/uploads/attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadProgress(percent);
        },
      });
      showToast('Document uploaded successfully!');
      fetchAttachments(attachmentModal.projectId, attachmentModal.taskId);
    } catch (err) {
      showToast(getErrorMessage(err, 'Error uploading attachment'), 'error');
    } finally {
      setUploadProgress(0);
    }
  };

  // Delete Attachment Trigger
  const handleDeleteAttachment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await api.delete(`/uploads/attachments/${id}`);
      showToast('Attachment deleted');
      fetchAttachments(attachmentModal.projectId, attachmentModal.taskId);
    } catch (err) {
      showToast(getErrorMessage(err, 'Error deleting attachment'), 'error');
    }
  };

  // Notification Actions
  const handleMarkAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read');
    } catch (err) {
      console.error(err);
    }
  };

  // Project Actions
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (projectModal.editId) {
        await api.put(`/projects/${projectModal.editId}`, {
          name: projectModal.name,
          description: projectModal.description,
          memberIds: projectModal.memberIds
        });
        showToast('Project updated successfully');
      } else {
        await api.post('/projects', {
          name: projectModal.name,
          description: projectModal.description,
          memberIds: projectModal.memberIds
        });
        showToast('Project created successfully');
      }
      setProjectModal({ open: false, name: '', description: '', memberIds: [] });
      fetchData('projects');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error saving project'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all its tasks.')) return;
    setActionLoading(true);
    try {
      await api.delete(`/projects/${id}`);
      showToast('Project deleted successfully');
      fetchData('projects');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error deleting project'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveProject = async (id: string, archiveState: boolean) => {
    setActionLoading(true);
    try {
      if (archiveState) {
        await api.patch(`/projects/${id}/archive`);
        showToast('Project archived successfully');
      } else {
        await api.patch(`/projects/${id}/restore`);
        showToast('Project restored successfully');
      }
      fetchData('projects');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error updating archive state'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Task Actions
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (taskModal.editId) {
        await api.put(`/tasks/${taskModal.editId}`, {
          title: taskModal.title,
          description: taskModal.description,
          projectId: taskModal.projectId,
          assignedUserId: taskModal.assignedUserId,
          status: taskModal.status,
          priority: taskModal.priority,
          dueDate: taskModal.dueDate || null
        });
        showToast('Task updated successfully');
      } else {
        await api.post('/tasks', {
          title: taskModal.title,
          description: taskModal.description,
          projectId: taskModal.projectId,
          assignedUserId: taskModal.assignedUserId,
          status: taskModal.status,
          priority: taskModal.priority,
          dueDate: taskModal.dueDate || null
        });
        showToast('Task created successfully');
      }
      setTaskModal({ open: false, title: '', description: '', projectId: '', assignedUserId: '', status: 'TODO', priority: 'MEDIUM', dueDate: '' });
      fetchData('tasks');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error saving task'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    setActionLoading(true);
    try {
      await api.delete(`/tasks/${id}`);
      showToast('Task deleted successfully');
      fetchData('tasks');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error deleting task'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (id: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE') => {
    try {
      await api.put(`/tasks/${id}`, { status: newStatus });
      showToast('Task status updated');
      fetchData('tasks');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error updating status'), 'error');
    }
  };

  // Member Actions
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post('/members/invite', {
        name: memberModal.name,
        email: memberModal.email,
        password: memberModal.password,
        role: memberModal.role
      });
      showToast('Member invited successfully');
      setMemberModal({ open: false, name: '', email: '', password: '', role: 'MEMBER' });
      fetchData('organization');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error inviting member'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteDemote = async (id: string, newRole: 'ADMIN' | 'MEMBER') => {
    setActionLoading(true);
    try {
      await api.put(`/members/${id}/role`, { role: newRole });
      showToast(`User role updated to ${newRole}`);
      fetchData('organization');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error updating member role'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    setActionLoading(true);
    try {
      await api.delete(`/members/${id}`);
      showToast('Member removed successfully');
      fetchData('organization');
    } catch (err) {
      showToast(getErrorMessage(err, 'Error removing member'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrganization = async () => {
    const doubleCheck = prompt('WARNING: This will permanently delete your organization and all associated user profiles, projects, and tasks. To confirm, type: DELETE ORG');
    if (doubleCheck !== 'DELETE ORG') {
      showToast('Deletion cancelled', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await api.delete('/members/organization/delete');
      showToast('Organization deleted. Logging out...');
      setTimeout(() => {
        logout();
        router.push('/register');
      }, 2000);
    } catch (err) {
      showToast(getErrorMessage(err, 'Error deleting organization'), 'error');
      setActionLoading(false);
    }
  };

  // Helper formatter
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Upload Progress Indicator Overlay */}
      {uploadProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 h-1.5 bg-slate-900 z-50 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-300 shadow shadow-indigo-500" 
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              S
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white leading-none">Console</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                {user?.tenant.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Notification Center */}
            <div className="relative">
              <button
                onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
                className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-black shadow-lg shadow-red-500/25 border border-slate-950">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Glassmorphic Dropdown */}
              {notificationMenuOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl p-4 shadow-2xl z-30 flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wide"
                      >
                        Mark All
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500 flex flex-col items-center gap-2">
                        <BellOff className="h-8 w-8 text-slate-700" />
                        <span>No notifications yet.</span>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 rounded-xl border text-xs flex flex-col gap-1 transition ${
                            notif.read
                              ? 'bg-slate-950/20 border-slate-900 text-slate-400'
                              : 'bg-indigo-950/10 border-indigo-900/30 text-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-100 leading-snug">{notif.title}</span>
                            {!notif.read && (
                              <button
                                onClick={() => handleMarkAsRead(notif.id)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 shrink-0 font-semibold"
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-400">{notif.message}</p>
                          <span className="text-[9px] text-slate-500 mt-0.5">{formatDate(notif.createdAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Click to Upload */}
            <div className="relative group h-10 w-10 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center overflow-hidden cursor-pointer shadow-md select-none shrink-0 transition hover:border-indigo-500">
              {user?.profileImage ? (
                <img 
                  src={`${BACKEND_URL}${user.profileImage}`} 
                  alt={user.name} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-black text-indigo-400">
                  {user?.name.substring(0, 2).toUpperCase()}
                </span>
              )}
              {/* Overlay hover prompt */}
              <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <input 
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                onChange={handleProfileImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Change Avatar Image"
              />
            </div>

            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-sm font-semibold text-slate-200">{user?.name}</span>
              <span className="text-xs text-slate-400 font-medium capitalize">{user?.role.toLowerCase()}</span>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-red-950/20 border border-slate-800 hover:border-red-900/50 hover:text-red-400 transition duration-200 font-medium text-sm text-slate-300 disabled:opacity-50"
            >
              {loggingOut ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 flex flex-col gap-2 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-3 py-2">Workspace Navigation</span>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Shield className="h-4 w-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === 'projects'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FolderKanban className="h-4 w-4" />
            Projects
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            Tasks
          </button>
          
          {user?.role !== 'MEMBER' && (
            <button
              onClick={() => setActiveTab('organization')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeTab === 'organization'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Building className="h-4 w-4" />
              Organization Settings
            </button>
          )}
        </aside>

        {/* Workspace Panels */}
        <main className="flex-1 min-w-0">
          
          {/* Toast Notification */}
          {toast && (
            <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium z-50 flex items-center gap-3 animate-fade-in ${
              toast.type === 'success' 
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' 
                : 'bg-red-950/80 border-red-800 text-red-300'
            }`}>
              <span className={`h-2 w-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {toast.message}
            </div>
          )}

          {loading && !stats && !projects.length && !tasks.length ? (
            <div className="h-64 flex items-center justify-center flex-col gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <span className="text-sm text-slate-400">Loading data...</span>
            </div>
          ) : (
            <>
              {/* Tab 1: OVERVIEW (Dynamic Stats) */}
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-8">
                  <section className="p-8 rounded-2xl border border-indigo-500/10 bg-gradient-to-r from-indigo-950/20 to-violet-950/20 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />
                    <div>
                      <span className="text-xs uppercase font-bold tracking-widest text-indigo-400 mb-2 block">Active Workspace</span>
                      <h2 className="text-3xl font-extrabold text-white mb-2">{user?.tenant.name}</h2>
                      <p className="text-slate-400 text-sm max-w-xl">
                        Advanced statistics, progress summary, and recent activities for this workspace.
                      </p>
                    </div>
                    {stats && (
                      <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl shrink-0 gap-1 text-center">
                        <span className="text-xs uppercase font-extrabold text-slate-500 tracking-wider">Progress Rate</span>
                        <div className="text-3xl font-black text-indigo-400">{stats.progressPercentage}%</div>
                        <div className="w-24 bg-slate-850 h-1.5 rounded-full overflow-hidden mt-1 border border-slate-800">
                          <div className="bg-indigo-500 h-full" style={{ width: `${stats.progressPercentage}%` }} />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Summary Metric Cards */}
                  {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/50 flex flex-col gap-3">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Projects</span>
                        <div className="text-2xl font-extrabold text-white">{stats.projects.total} Total</div>
                        <div className="flex gap-4 text-xs text-slate-400">
                          <span>{stats.projects.active} Active</span>
                          <span>{stats.projects.archived} Archived</span>
                        </div>
                      </div>
                      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/50 flex flex-col gap-3">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Tasks</span>
                        <div className="text-2xl font-extrabold text-white">{stats.tasks.total} Tasks</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <CircleIcon className="h-2.5 w-2.5 bg-indigo-400" />
                          <span>{stats.tasks.statusCounts.DONE} Completed</span>
                        </div>
                      </div>
                      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/50 flex flex-col gap-3">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Tasks Statuses</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-400 font-medium">
                          <div>Todo: {stats.tasks.statusCounts.TODO}</div>
                          <div>In Progress: {stats.tasks.statusCounts.IN_PROGRESS}</div>
                          <div>Review: {stats.tasks.statusCounts.REVIEW}</div>
                          <div>Done: {stats.tasks.statusCounts.DONE}</div>
                        </div>
                      </div>
                      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/50 flex flex-col gap-3">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Tasks Priority</span>
                        <div className="grid grid-cols-3 gap-1 text-[11px] font-bold mt-1 text-center">
                          <div className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/10">High: {stats.tasks.priorityCounts.HIGH}</div>
                          <div className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/10">Med: {stats.tasks.priorityCounts.MEDIUM}</div>
                          <div className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/10">Low: {stats.tasks.priorityCounts.LOW}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Details Panel */}
                    <div className="md:col-span-2 p-6 rounded-2xl border border-slate-900 bg-slate-950/40 flex flex-col gap-4">
                      <div className="flex items-center gap-3 border-b border-slate-900 pb-3">
                        <Sparkles className="h-5 w-5 text-indigo-400" />
                        <h3 className="font-bold text-white text-sm uppercase tracking-wider">Recent Activities Log</h3>
                      </div>
                      
                      {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                        <div className="flex flex-col gap-4">
                          {stats.recentActivities.map((act) => (
                            <div key={act.id} className="flex items-start gap-3.5 text-xs text-slate-300">
                              <div className="h-6 w-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-400 font-extrabold font-mono">
                                {act.type.startsWith('PROJECT') ? 'P' : 'T'}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-200">{act.message}</p>
                                <span className="text-[10px] text-slate-500 block mt-1">{formatDate(act.time)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-xs text-slate-500">No recent activities available.</div>
                      )}
                    </div>

                    {/* Right Presence and Session Panels */}
                    <div className="flex flex-col gap-6">
                      {/* Presence Tracker */}
                      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 flex flex-col gap-4">
                        <div className="flex items-center gap-3 border-b border-slate-900 pb-3">
                          <Users className="h-5 w-5 text-indigo-400" />
                          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Online Presence</h3>
                        </div>
                        
                        <div className="flex flex-col gap-3.5 py-1">
                          {members.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">No member information loaded.</span>
                          ) : (
                            members.map((m) => {
                              const isOnline = onlineUserIds.includes(m.id);
                              return (
                                <div key={m.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    {/* Member avatar image in listing */}
                                    <div className="h-5 w-5 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center text-[8px] font-black text-slate-400 shrink-0">
                                      {m.profileImage ? (
                                        <img 
                                          src={`${BACKEND_URL}${m.profileImage}`} 
                                          alt={m.name} 
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        m.name.substring(0, 1).toUpperCase()
                                      )}
                                    </div>
                                    <span className="font-semibold text-slate-200">{m.name}</span>
                                    <span className="text-[10px] text-slate-500">({m.role.toLowerCase()})</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                                    <span className={`font-bold ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                                      {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Session Info */}
                      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 flex flex-col gap-4">
                        <div className="flex items-center gap-3 border-b border-slate-900 pb-3">
                          <Globe className="h-5 w-5 text-indigo-400" />
                          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Session Info</h3>
                        </div>
                        <div className="flex flex-col gap-3 py-1">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">User Account</span>
                            <span className="text-slate-200 text-sm font-semibold">{user?.name}</span>
                            <span className="text-[11px] text-slate-400">{user?.email}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Role Access</span>
                            <span className="text-slate-200 text-xs font-bold uppercase text-indigo-400">{user?.role}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: PROJECTS */}
              {activeTab === 'projects' && (
                <div className="flex flex-col gap-6">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">Projects Workspace</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Advanced CRUD: Create, update, delete, archive, or restore workspace projects.
                      </p>
                    </div>
                    {user?.role !== 'MEMBER' && (
                      <button
                        onClick={() => setProjectModal({ open: true, name: '', description: '', memberIds: [] })}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition shadow-lg shadow-indigo-600/10 text-white select-none shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Create Project
                      </button>
                    )}
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-slate-950/40 p-4 border border-slate-900 rounded-2xl">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input 
                        type="text"
                        value={projSearch}
                        onChange={(e) => {
                          setProjSearch(e.target.value);
                          setProjPage(1);
                        }}
                        placeholder="Search projects by name..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-indigo-600 text-slate-200"
                      />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Archived Toggle */}
                      <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold cursor-pointer select-none text-slate-300">
                        <input 
                          type="checkbox"
                          checked={projArchived}
                          onChange={(e) => {
                            setProjArchived(e.target.checked);
                            setProjPage(1);
                          }}
                          className="rounded border-slate-750 bg-slate-950 text-indigo-600 focus:ring-0"
                        />
                        <span>Show Archived Only</span>
                      </label>

                      {/* Sort selection */}
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                        <select
                          value={projSortBy}
                          onChange={(e) => {
                            setProjSortBy(e.target.value as 'newest' | 'oldest' | 'alphabetical');
                            setProjPage(1);
                          }}
                          className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none border-none pr-4"
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                          <option value="alphabetical">Alphabetical</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Project Cards List */}
                  {projects.length === 0 ? (
                    <div className="p-12 rounded-2xl border border-slate-900 bg-slate-950/30 text-center flex flex-col items-center justify-center">
                      <FolderKanban className="h-12 w-12 text-slate-600 mb-3" />
                      <h4 className="text-base font-semibold text-slate-300">No projects found</h4>
                      <p className="text-slate-500 text-xs mt-1 max-w-sm">
                        No projects matched your active search filters or archives toggle.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {projects.map((project) => (
                        <div key={project.id} className={`p-6 rounded-2xl border bg-slate-950/40 hover:bg-slate-950/80 transition flex flex-col justify-between gap-4 ${project.archived ? 'border-red-950/40 opacity-70 hover:opacity-100' : 'border-slate-900'}`}>
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-lg font-bold text-white leading-tight">{project.name}</h3>
                                  {project.archived && (
                                    <span className="px-2 py-0.5 rounded bg-red-950/30 text-red-400 border border-red-900/30 text-[9px] font-bold uppercase tracking-wider">
                                      Archived
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium block">
                                  Created {formatDate(project.createdAt)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {/* Attachments paperclip link */}
                                <button
                                  onClick={() => setAttachmentModal({
                                    open: true,
                                    projectId: project.id,
                                    title: `Attachments for Project: ${project.name}`
                                  })}
                                  className="p-2 rounded-lg bg-slate-900 hover:bg-indigo-950/30 text-slate-400 hover:text-indigo-400 transition border border-transparent hover:border-indigo-900/30"
                                  title="Project Attachments"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>

                                {user?.role !== 'MEMBER' && (
                                  <>
                                    <button
                                      onClick={() => handleArchiveProject(project.id, !project.archived)}
                                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                      title={project.archived ? 'Restore Project' : 'Archive Project'}
                                    >
                                      {project.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                    </button>
                                    <button
                                      onClick={() => setProjectModal({
                                        open: true,
                                        editId: project.id,
                                        name: project.name,
                                        description: project.description || '',
                                        memberIds: project.members.map((m) => m.id)
                                      })}
                                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                      title="Edit Project"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProject(project.id)}
                                      className="p-2 rounded-lg bg-slate-900 hover:bg-red-950/35 text-slate-400 hover:text-red-400 transition border border-transparent hover:border-red-900/50"
                                      title="Delete Project"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 line-clamp-3">
                              {project.description || 'No description provided.'}
                            </p>
                          </div>

                          <div className="border-t border-slate-900 pt-4 mt-2">
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-2 block">Assigned Members</span>
                            <div className="flex flex-wrap gap-1.5">
                              {project.members.length === 0 ? (
                                <span className="text-[11px] text-slate-500 italic">No assigned members.</span>
                              ) : (
                                project.members.map((member) => (
                                  <span 
                                    key={member.id} 
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                  >
                                    {member.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination Footer */}
                  {projPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-900 pt-6 mt-4 text-xs font-semibold text-slate-400">
                      <span>
                        Page {projPagination.page} of {projPagination.totalPages} ({projPagination.total} Total)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={projPagination.page <= 1}
                          onClick={() => setProjPage(projPagination.page - 1)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 transition"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          disabled={projPagination.page >= projPagination.totalPages}
                          onClick={() => setProjPage(projPagination.page + 1)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 transition"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: TASKS */}
              {activeTab === 'tasks' && (
                <div className="flex flex-col gap-6">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">Tasks Workspace</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Advanced CRUD: Assign responsibilities, adjust status, set priorities, and establish deadlines.
                      </p>
                    </div>
                    {projects.length > 0 && (
                      <button
                        onClick={() => {
                          const initialProj = projects[0]?.id || '';
                          setTaskModal({
                            open: true,
                            title: '',
                            description: '',
                            projectId: initialProj,
                            assignedUserId: user?.role === 'MEMBER' ? (user?.id || '') : '',
                            status: 'TODO',
                            priority: 'MEDIUM',
                            dueDate: ''
                          });
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition shadow-lg shadow-indigo-600/10 text-white select-none shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Create Task
                      </button>
                    )}
                  </div>

                  {/* Filters, Sorting, Search grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 bg-slate-950/40 p-4 border border-slate-900 rounded-2xl">
                    <div className="relative col-span-1 sm:col-span-2">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input 
                        type="text"
                        value={taskSearch}
                        onChange={(e) => {
                          setTaskSearch(e.target.value);
                          setTaskPage(1);
                        }}
                        placeholder="Search tasks by title..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-indigo-600 text-slate-200"
                      />
                    </div>

                    {/* Project Filter */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
                      <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <select
                        value={taskProjectId}
                        onChange={(e) => {
                          setTaskProjectId(e.target.value);
                          setTaskPage(1);
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none border-none pr-4 w-full"
                      >
                        <option value="">All Projects</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
                      <ListTodo className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <select
                        value={taskStatus}
                        onChange={(e) => {
                          setTaskStatus(e.target.value);
                          setTaskPage(1);
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none border-none pr-4 w-full"
                      >
                        <option value="">All Statuses</option>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="REVIEW">Review</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>

                    {/* Priority Filter */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
                      <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <select
                        value={taskPriority}
                        onChange={(e) => {
                          setTaskPriority(e.target.value);
                          setTaskPage(1);
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none border-none pr-4 w-full"
                      >
                        <option value="">All Priority</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>

                    {/* Sort selector */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl col-span-1">
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <select
                        value={taskSortBy}
                        onChange={(e) => {
                          setTaskSortBy(e.target.value as 'newest' | 'oldest' | 'priority' | 'dueDate');
                          setTaskPage(1);
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none border-none pr-4 w-full"
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="priority">Priority Order</option>
                        <option value="dueDate">Due Date Order</option>
                      </select>
                    </div>
                  </div>

                  {/* Tasks List */}
                  {tasks.length === 0 ? (
                    <div className="p-12 rounded-2xl border border-slate-900 bg-slate-950/30 text-center flex flex-col items-center justify-center">
                      <CheckSquare className="h-12 w-12 text-slate-600 mb-3" />
                      <h4 className="text-base font-semibold text-slate-300">No tasks found</h4>
                      <p className="text-slate-500 text-xs mt-1 max-w-sm">
                        No tasks matched your active search query or status, priority filters.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {tasks.map((task) => (
                        <div key={task.id} className="p-5 rounded-2xl border border-slate-900 bg-slate-950/40 hover:bg-slate-950/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3.5 flex-wrap">
                              <h3 className="font-bold text-white text-base leading-snug">{task.title}</h3>
                              
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-850">
                                {task.project.name}
                              </span>

                              {/* Priority badge */}
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                task.priority === 'HIGH' 
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                  : task.priority === 'MEDIUM' 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                {task.priority}
                              </span>

                              {/* Status badge */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                                task.status === 'DONE' 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                  : task.status === 'REVIEW'
                                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                                    : task.status === 'IN_PROGRESS'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                      : 'bg-slate-800 text-slate-400 border border-transparent'
                              }`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{task.description || 'No description provided.'}</p>
                            
                            <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-2 flex-wrap">
                              <span>Creator: <b className="text-slate-300 font-semibold">{task.creator.name}</b></span>
                              <span>Assignee: <b className="text-indigo-400 font-semibold">{task.assignedUser?.name || 'Unassigned'}</b></span>
                              
                              {task.dueDate && (
                                <span className="flex items-center gap-1 font-semibold text-slate-400">
                                  <Calendar className="h-3 w-3 text-slate-500" />
                                  Due: {formatDate(task.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {/* Attachments paperclip trigger */}
                            <button
                              onClick={() => setAttachmentModal({
                                open: true,
                                taskId: task.id,
                                title: `Attachments for Task: ${task.title}`
                              })}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-indigo-950/30 text-slate-400 hover:text-indigo-400 transition border border-transparent hover:border-indigo-900/30"
                              title="Task Attachments"
                            >
                              <Paperclip className="h-4 w-4" />
                            </button>

                            {/* Fast status updater */}
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE')}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="REVIEW">Review</option>
                              <option value="DONE">Done</option>
                            </select>

                            {user?.role !== 'MEMBER' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setTaskModal({
                                    open: true,
                                    editId: task.id,
                                    title: task.title,
                                    description: task.description || '',
                                    projectId: task.projectId,
                                    assignedUserId: task.assignedUserId || '',
                                    status: task.status,
                                    priority: task.priority,
                                    dueDate: task.dueDate ? task.dueDate.split('T')[0] : ''
                                  })}
                                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                  title="Edit Task"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-2 rounded-lg bg-slate-900 hover:bg-red-950/35 text-slate-400 hover:text-red-400 transition border border-transparent hover:border-red-900/50"
                                  title="Delete Task"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Task Pagination Footer */}
                  {taskPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-900 pt-6 mt-4 text-xs font-semibold text-slate-400">
                      <span>
                        Page {taskPagination.page} of {taskPagination.totalPages} ({taskPagination.total} Total)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={taskPagination.page <= 1}
                          onClick={() => setTaskPage(taskPagination.page - 1)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 transition"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          disabled={taskPagination.page >= taskPagination.totalPages}
                          onClick={() => setTaskPage(taskPagination.page + 1)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 transition"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: ORGANIZATION */}
              {activeTab === 'organization' && user?.role !== 'MEMBER' && (
                <div className="flex flex-col gap-8">
                  {/* Org settings and invitation */}
                  <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">Organization Settings</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        View members, edit roles, invite new collaborators, or delete the entire tenant space.
                      </p>
                    </div>

                    <button
                      onClick={() => setMemberModal({ open: true, name: '', email: '', password: '', role: 'MEMBER' })}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition shadow-lg shadow-indigo-600/10 text-white select-none shrink-0"
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite Member
                    </button>
                  </div>

                  {/* Members list */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/30 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-900 flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">Member Roster</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                        {members.length} Users
                      </span>
                    </div>

                    <div className="divide-y divide-slate-900">
                      {members.map((member) => (
                        <div key={member.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              {/* Pulse circle next to the user if online */}
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${onlineUserIds.includes(member.id) ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                              {/* Roster member avatar */}
                              <div className="h-6 w-6 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                                {member.profileImage ? (
                                  <img 
                                    src={`${BACKEND_URL}${member.profileImage}`} 
                                    alt={member.name} 
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  member.name.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <h4 className="font-bold text-slate-100">{member.name}</h4>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                member.role === 'OWNER' 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                                  : member.role === 'ADMIN'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                              }`}>
                                {member.role}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block mt-0.5 ml-14.5">{member.email}</span>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {user?.role === 'OWNER' && member.id !== user.id && (
                              <>
                                {/* Role Demote / Promote selection */}
                                {member.role !== 'OWNER' && (
                                  <select
                                    value={member.role}
                                    onChange={(e) => handlePromoteDemote(member.id, e.target.value as 'ADMIN' | 'MEMBER')}
                                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 focus:outline-none"
                                  >
                                    <option value="MEMBER">Member Role</option>
                                    <option value="ADMIN">Admin Role</option>
                                  </select>
                                )}

                                {/* Remove member button */}
                                {member.role !== 'OWNER' && (
                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="p-1.5 rounded bg-slate-900 hover:bg-red-950/20 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-950 transition"
                                    title="Remove Member"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}

                            {member.id === user?.id && (
                              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5" />
                                Active Profile
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Danger Zone: delete org (OWNER only) */}
                  {user?.role === 'OWNER' && (
                    <div className="mt-4 p-6 rounded-2xl border border-red-500/10 bg-red-950/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div>
                        <h4 className="font-extrabold text-white text-base flex items-center gap-2 text-red-400">
                          <AlertTriangle className="h-5 w-5" />
                          Danger Zone
                        </h4>
                        <p className="text-slate-400 text-xs mt-1.5 max-w-xl">
                          Permanently delete your workspace, databases, and configuration settings. This operation is non-reversible.
                        </p>
                      </div>

                      <button
                        onClick={handleDeleteOrganization}
                        disabled={actionLoading}
                        className="px-4 py-2.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-900/50 hover:border-red-800 font-bold text-sm text-red-200 transition select-none self-start sm:self-auto shrink-0"
                      >
                        Delete Organization
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ---------------------------------------------------- */}
      {/* NEW: Attachment Manager Modal */}
      {/* ---------------------------------------------------- */}
      <AttachmentModal
        open={attachmentModal.open}
        title={attachmentModal.title}
        isLoading={attachmentsLoading}
        attachments={attachments}
        onClose={() => setAttachmentModal({ open: false, title: '' })}
        onUpload={handleUploadAttachment}
        onDelete={handleDeleteAttachment}
      />

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: Create / Edit Project Modal */}
      {/* ---------------------------------------------------- */}
      {projectModal.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-950 p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="font-bold text-lg text-white">
                {projectModal.editId ? 'Edit Project' : 'Create Project'}
              </h3>
              <button 
                onClick={() => setProjectModal({ open: false, name: '', description: '', memberIds: [] })}
                className="text-slate-500 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project Name</label>
                <input 
                  type="text" 
                  required
                  value={projectModal.name}
                  onChange={(e) => setProjectModal({ ...projectModal, name: e.target.value })}
                  placeholder="e.g. Q3 Roadmap"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description</label>
                <textarea 
                  value={projectModal.description}
                  onChange={(e) => setProjectModal({ ...projectModal, description: e.target.value })}
                  placeholder="Enter details about this project..."
                  rows={3}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assign Members</label>
                <div className="max-h-36 overflow-y-auto border border-slate-900 rounded-xl bg-slate-950 p-3 divide-y divide-slate-900 flex flex-col gap-2">
                  {members.map((member) => (
                    <label key={member.id} className="flex items-center gap-3.5 py-1.5 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={projectModal.memberIds.includes(member.id)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...projectModal.memberIds, member.id]
                            : projectModal.memberIds.filter((id) => id !== member.id);
                          setProjectModal({ ...projectModal, memberIds: updated });
                        }}
                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0 h-4 w-4"
                      />
                      <div className="flex flex-col border-none">
                        <span className="text-xs font-bold text-slate-200">{member.name}</span>
                        <span className="text-[10px] text-slate-500">{member.email} ({member.role.toLowerCase()})</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition shadow-lg shadow-indigo-600/10 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Project'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: Create / Edit Task Modal */}
      {/* ---------------------------------------------------- */}
      {taskModal.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-950 p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="font-bold text-lg text-white">
                {taskModal.editId ? 'Edit Task' : 'Create Task'}
              </h3>
              <button 
                onClick={() => setTaskModal({ open: false, title: '', description: '', projectId: '', assignedUserId: '', status: 'TODO', priority: 'MEDIUM', dueDate: '' })}
                className="text-slate-500 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Task Title</label>
                <input 
                  type="text" 
                  required
                  value={taskModal.title}
                  onChange={(e) => setTaskModal({ ...taskModal, title: e.target.value })}
                  placeholder="e.g. Implement backend authorization checks"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description</label>
                <textarea 
                  value={taskModal.description}
                  onChange={(e) => setTaskModal({ ...taskModal, description: e.target.value })}
                  placeholder="Provide detailed criteria..."
                  rows={2}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Project */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Select Project</label>
                  <select
                    required
                    value={taskModal.projectId}
                    onChange={(e) => setTaskModal({ ...taskModal, projectId: e.target.value })}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Select Assignee */}
                {user?.role !== 'MEMBER' ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assign To</label>
                    <select
                      value={taskModal.assignedUserId}
                      onChange={(e) => setTaskModal({ ...taskModal, assignedUserId: e.target.value })}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role.toLowerCase()})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assign To</label>
                    <div className="px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-805 text-sm text-slate-400 select-none">
                      Assigning to yourself ({user?.name})
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</label>
                  <select
                    value={taskModal.status}
                    onChange={(e) => setTaskModal({ ...taskModal, status: e.target.value as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' })}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Priority</label>
                  <select
                    value={taskModal.priority}
                    onChange={(e) => setTaskModal({ ...taskModal, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              {/* Due Date selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due Date</label>
                <input 
                  type="date"
                  value={taskModal.dueDate}
                  onChange={(e) => setTaskModal({ ...taskModal, dueDate: e.target.value })}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition shadow-lg shadow-indigo-600/10 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: Invite Member Modal */}
      {/* ---------------------------------------------------- */}
      {memberModal.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-950 p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h3 className="font-bold text-lg text-white">
                Invite New Collaborator
              </h3>
              <button 
                onClick={() => setMemberModal({ open: false, name: '', email: '', password: '', role: 'MEMBER' })}
                className="text-slate-500 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={memberModal.name}
                  onChange={(e) => setMemberModal({ ...memberModal, name: e.target.value })}
                  placeholder="e.g. Alice Smith"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={memberModal.email}
                  onChange={(e) => setMemberModal({ ...memberModal, email: e.target.value })}
                  placeholder="alice@domain.com"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Initial Password</label>
                <input 
                  type="password" 
                  required
                  value={memberModal.password}
                  onChange={(e) => setMemberModal({ ...memberModal, password: e.target.value })}
                  placeholder="••••••••"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Role</label>
                <select
                  value={memberModal.role}
                  onChange={(e) => setMemberModal({ ...memberModal, role: e.target.value as 'ADMIN' | 'MEMBER' })}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-600"
                >
                  <option value="MEMBER">Member (Task tracking, views own projects)</option>
                  <option value="ADMIN">Admin (Create projects/tasks, invite collaborators)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition shadow-lg shadow-indigo-600/10 disabled:opacity-50"
              >
                {actionLoading ? 'Inviting...' : 'Invite Collaborator'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CircleIcon({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${className}`} {...props} />
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
