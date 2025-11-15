import "./App.css";
import { useState, useRef, useEffect } from "react";

interface Todo {
  id: string;
  task: string;
  completed: boolean;
}

function App() {
  const [todoList, setTodoList] = useState<Todo[]>([]);
  const [currentTask, setCurrentTask] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const API_URL = "http://localhost:3001/api/todos";

  // Fetch todos from the server on component mount
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setTodoList(data);
    } catch (error) {
      console.error("Error fetching todos:", error);
    }
  };

  const addTask = async () => {
    if (!currentTask.trim()) return;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: currentTask }),
      });
      const newTodo = await response.json();
      setTodoList([...todoList, newTodo]);
      if (inputRef.current) inputRef.current.value = "";
      setCurrentTask("");
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      setTodoList(todoList.filter((task) => task.id !== id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const toggleCompleteTask = async (id: string) => {
    const task = todoList.find((t) => t.id === id);
    if (!task) return;

    try {
      await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      setTodoList(
        todoList.map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t
        )
      );
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-6xl font-bold text-center mb-8 text-gray-800">
          To Do List
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
              onChange={(event) => {
                setCurrentTask(event.target.value);
              }}
              ref={inputRef}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addTask();
                }
              }}
            />
            <button
              className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              onClick={addTask}
            >
              Add Task
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {todoList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No tasks yet. Add one above!</p>
            </div>
          ) : (
            todoList.map((val) => {
              return (
                <div
                  key={val.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 flex items-center gap-3"
                >
                  <div className="flex-1 flex items-center gap-3">
                    <div
                      className={`flex-1 text-lg font-medium ${
                        val.completed
                          ? "line-through text-gray-400"
                          : "text-gray-800"
                      }`}
                    >
                      {val.task}
                    </div>
                    {val.completed && (
                      <span className="text-2xl text-green-500">✓</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                        val.completed
                          ? "bg-yellow-400 hover:bg-yellow-500 text-white"
                          : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                      onClick={() => toggleCompleteTask(val.id)}
                    >
                      {val.completed ? "Undo" : "Complete"}
                    </button>
                    <button
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                      onClick={() => deleteTask(val.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
