import React, { createContext, useContext, useMemo, useReducer, useRef, useEffect } from 'react';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { TaskService } from '../services/TaskService';
import { listTaskTopics } from '../services/taskTopics';
import { listVehicles, createVehicle } from '../services/vehicles';
import { auth } from '../store/auth';

import type { Tab } from '../store/TabContext';

type Car = { id: string; brand: string; model: string; color: string; plate: string; holder?: string };

type State = {
  user: User;
  role: 'superadmin' | 'manager' | 'employee';
  contextUserId?: string;
  team: User[];
  topics: string[];
  tasks: Task[];
  archivedTasks: Task[];
  cars: Car[];
  statusFilter?: any;
  priorityFilter?: any;
};

type Action =
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'SET_TOPICS'; topics: string[] }
  | { type: 'ADD_TOPIC'; label: string }
  | { type: 'SET_CARS'; cars: Car[] }
  | { type: 'ADD_CAR'; car: Car }
  | { type: 'DELETE_CAR'; id: string }
  | { type: 'TAKE_CAR'; id: string; holder?: string }
  | { type: 'RELEASE_CAR'; id: string }
  | { type: 'SET_STATUS_FILTER'; value?: any }
  | { type: 'SET_PRIORITY_FILTER'; value?: any }
  ;

const initialState: State = {
  role: 'employee',
  user: new User('me', 'Я', 'Сотрудник', 'В офисе', { links: { telegram: '', whatsapp: '', email: '', phone: '' } }),
  contextUserId: undefined,
  team: [], topics: [], tasks: [], archivedTasks: [], cars: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_TASKS': return { ...state, tasks: action.tasks };
    case 'SET_TOPICS': return { ...state, topics: action.topics };
    case 'ADD_TOPIC': return { ...state, topics: state.topics.includes(action.label) ? state.topics : [...state.topics, action.label] };
    case 'SET_CARS': return { ...state, cars: action.cars };
    case 'ADD_CAR': return { ...state, cars: [...state.cars, action.car] };
    case 'DELETE_CAR': return { ...state, cars: state.cars.filter(c => c.id !== action.id) };
    case 'TAKE_CAR': return { ...state, cars: state.cars.map(c => c.id === action.id ? { ...c, holder: action.holder ?? state.user.fullName } : c) };
    case 'RELEASE_CAR': return { ...state, cars: state.cars.map(c => c.id === action.id ? { ...c, holder: undefined } : c) };
    case 'SET_STATUS_FILTER': return { ...state, statusFilter: action.value };
    case 'SET_PRIORITY_FILTER': return { ...state, priorityFilter: action.value };
    default: return state;
  }
}

type Service = {
  setStatus: (id: string, status: any) => Promise<void>;
  setAssignee: (id: string, assigneeId?: string | null) => Promise<void>;
  setTeam: (teamId?: string | null) => void;
  addAttachment: (taskId: string, file: any) => Promise<void>;
  deleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  create: (payload: Partial<Task>) => Promise<void>;
  createCommon: (payload: Partial<Task>) => Promise<void>;
  takeCommon: (id: string) => Promise<void>;
  returnCommon: (id: string) => Promise<void>;
  addCar: (car: Omit<Car,'id'>) => Promise<void>;
  deleteCar: (id: string) => void;
  takeCar: (id: string, holder?: string) => void;
  releaseCar: (id: string) => void;
};

const Ctx = createContext<{ state: State; service: Service; dispatch: React.Dispatch<Action> }>({} as any);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // держим ref на актуальное состояние — для стабильного TaskService
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // стабильный экземпляр TaskService
  const taskServiceRef = useRef<TaskService | null>(null);
  if (!taskServiceRef.current) {
    taskServiceRef.current = new TaskService(
      () => stateRef.current.tasks,
      (tasks) => dispatch({ type: 'SET_TASKS', tasks })
    );
  }
  const taskService = taskServiceRef.current;

  // Загружаем данные ТОЛЬКО когда есть профиль (userId)
  useEffect(() => {
    const uid = auth.profile?.userId;
    if (uid == null) return;
    taskService.setCurrentUser(String(uid));
    (async () => {
      try {
        await taskService.sync(String(uid));
      } catch (e) { console.warn('tasks sync failed', e); }
      try {
        const topics = (await listTaskTopics()).map((t: any) => t.name ?? t.label ?? t);
        dispatch({ type: 'SET_TOPICS', topics });
      } catch {}
      try {
        const items = await listVehicles();
        const cars = items.map((v: any) => ({ id: String(v.id), brand: v.brand ?? '', model: v.model ?? '', color: v.color ?? '', plate: v.number ?? '' }));
        dispatch({ type: 'SET_CARS', cars });
      } catch {}
    })();
  }, [auth.profile?.userId]); // ключ: только при смене пользователя

  const service: Service = useMemo(() => ({
    setStatus: async (id, status) => { await taskService.setStatus(id, status); },
    setAssignee: async (id, assigneeId) => { await taskService.setAssignee(id, assigneeId ?? null); },
    setTeam: (teamId) => { taskService.setTeam(teamId); },
    addAttachment: (taskId, file) => taskService.addAttachment(taskId, file),
    deleteAttachment: (taskId, attachmentId) => taskService.deleteAttachment(taskId, attachmentId),
    create: async (payload) => { await taskService.create(payload); },
    createCommon: async (payload) => { await taskService.createCommon(payload); },
    takeCommon: async (id) => { await taskService.takeCommon(id); },
    returnCommon: async (id) => { await taskService.returnCommon(id); },
    addCar: async ({ brand, model, color, plate }) => {
      await createVehicle({ number: plate, brand, model, color: color || undefined });
      const items = await listVehicles();
      const cars = items.map((v: any) => ({ id: String(v.id), brand: v.brand ?? '', model: v.model ?? '', color: v.color ?? '', plate: v.number ?? '' }));
      dispatch({ type: 'SET_CARS', cars });
    },
    deleteCar: (id) => dispatch({ type: 'DELETE_CAR', id }),
    takeCar: (id, holder) => dispatch({ type: 'TAKE_CAR', id, holder }),
    releaseCar: (id) => dispatch({ type: 'RELEASE_CAR', id }),
  }), [taskService]);

  return <Ctx.Provider value={{ state, service, dispatch }}>{children}</Ctx.Provider>;
}

export function useApp() { return useContext(Ctx); }
