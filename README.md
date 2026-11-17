# PW IOI Attendance Pro 🎓

A modern, privacy-focused Chrome Extension crafted specifically for **PhysicsWallah Institute of Innovation (PW IOI)** students (`https://app.pwioi.club/dashboard/student/attendance`).

It calculates **allowable absences**, **required classes to reach target attendance**, estimated **calendar recovery days**, and provides an interactive **Date-Range Attendance Simulator with Deficit Support**.

---

## 🌟 Key Features

1. **Auto-Sync with PW IOI Portal**:
   - Automatically detects attendance when you are logged into `https://app.pwioi.club/dashboard/student/attendance`.
   - Accesses authenticated session data and parses the attendance table/cards.
   - Stores data locally in your browser with zero external server transmission.

2. **Seamless Dual Experience (In-DOM Container + Extension Popup)**:
   - **In-DOM Container**: Injected directly below the portal attendance dashboard with target selectors, required classes counter, and absence allowances.
   - **Extension Toolbar Popup**: Simulation toolkit featuring the Date Simulator, Weekday Schedule customizer, and Course analytics.

3. **Attendance & Recovery Mathematics**:
   - **Target Selector**: Quick presets for `75%`, `80%`, `85%`, `90%`, or custom target.
   - **Consecutive Classes Required**: Exact formula:
     $$\lceil (r \cdot T - A) / (1 - r) \rceil$$
   - **Recovery Days**: Translates required classes into realistic college days based on **4 to 5 classes per day** (Monday through Friday).

4. **Deficit and Absence Margin Support**:
   - Above target: Displays allowable absences (e.g. `+6 Classes`).
   - Below target: Displays negative deficit (e.g. `-7 Classes`), indicating that all upcoming classes plus deficit classes must be attended.

5. **Date-Range Simulator**:
   - Select date ranges (*This Week*, *Next Week*, *2 Weeks*, or *30 Days*).
   - Counts Monday–Friday scheduled classes.
   - Reports exact allowable absences or deficit for the period.
   - **Absence Slider**: Adjust simulated absences to view projected attendance percentage in real time.

6. **Customizable Daily Schedule**:
   - Default: Monday (5), Tuesday (5), Wednesday (5), Thursday (4), Friday (5).
   - Adjust daily class counts in the simulator settings.

7. **Course Breakdown**:
   - Progress bar and allowable absences / required classes indicator for each course.

8. **Design Architecture**:
   - **Vercel Developer Theme**: Clean monochrome foundation with Geist typography, monospace data fields, crisp 1px borders, and high contrast.
   - **Purposeful Subtle Red / Green Semantics**: Instant comprehension of safety margins vs deficits without visual noise.
   - **Unified Simulator**: Interactive date-range planning and what-if simulation combined into a single, cohesive card with zero redundant metrics.

---

## 🚀 How to Install in Chrome (30 Seconds)

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions/` in your address bar.
3. Turn on the **Developer mode** toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. Select this folder:
   ```
   /Users/shiv/attendance_extension
   ```
6. The extension **PW IOI Attendance Pro** is now loaded! Pin it to your Chrome toolbar for quick access.

---

## 🔒 Privacy & Login Security

- This extension runs **100% locally** in your Chrome browser.
- It never sends your student credentials or attendance data to any external server.
- Simply log in to `https://app.pwioi.club/dashboard/student/attendance` using your official student Google account, and the extension will sync seamlessly.
