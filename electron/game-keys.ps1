# Observe only Tab and foreground-window geometry through Windows APIs.
# No keyboard hook, input interception, process handle, game memory, or injection.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DpmGameKeys {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd, ref POINT point);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  public static void Run() {
    SetThreadDpiAwarenessContext(new IntPtr(-4)); // Physical pixels, including mixed-DPI displays.
    string previous = "";
    while (true) {
      var hwnd = GetForegroundWindow(); var title = new StringBuilder(256); GetWindowText(hwnd, title, 256);
      bool game = title.ToString().Equals("League of Legends (TM) Client", StringComparison.OrdinalIgnoreCase);
      bool tab = game && (GetAsyncKeyState(0x09) & 0x8000) != 0;
      RECT rect; POINT point = new POINT();
      string bounds = "null";
      if (game && GetClientRect(hwnd, out rect) && ClientToScreen(hwnd, ref point)) bounds = "{\"x\":" + point.X + ",\"y\":" + point.Y + ",\"width\":" + (rect.Right-rect.Left) + ",\"height\":" + (rect.Bottom-rect.Top) + "}";
      string data = "{\"focused\":" + (game ? "true" : "false") + ",\"tab\":" + (tab ? "true" : "false") + ",\"bounds\":" + bounds + "}";
      if (data != previous) { Console.WriteLine(data); Console.Out.Flush(); previous = data; }
      System.Threading.Thread.Sleep(80);
    }
  }
}
'@
[DpmGameKeys]::Run()
