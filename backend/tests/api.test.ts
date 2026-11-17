import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AchievementPost } from '../src/models/AchievementPost.js';
import { AthleteProfile } from '../src/models/AthleteProfile.js';
import { ConnectionRequest } from '../src/models/ConnectionRequest.js';
import { User } from '../src/models/User.js';

const app = createApp();

afterEach(async () => {
  await Promise.all([AchievementPost.deleteMany({}), AthleteProfile.deleteMany({}), ConnectionRequest.deleteMany({}), User.deleteMany({})]);
});

describe('Talent Hub API', () => {
  it('renews expired access sessions and revokes refresh sessions on logout', async () => {
    await request(app).post('/api/register').send({
      username: 'session_runner',
      email: 'session-runner@example.com',
      password: 'secure-password',
      role: 'talent',
    });

    const login = await request(app).post('/api/login').send({
      email: 'session-runner@example.com',
      password: 'secure-password',
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers['set-cookie'];
    if (!setCookie) throw new Error('Login did not set a refresh cookie.');
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!cookieHeader) throw new Error('Login did not set a refresh cookie.');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Path=/api');
    const refreshCookie = cookieHeader.split(';')[0];
    if (!refreshCookie) throw new Error('Login did not set a refresh cookie.');

    const refreshed = await request(app)
      .post('/api/refresh')
      .set('Cookie', refreshCookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.user.id).toBe(login.body.data.user.id);

    const protectedRequest = await request(app)
      .get('/api/connections')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken as string}`);
    expect(protectedRequest.status).toBe(200);

    const logout = await request(app)
      .post('/api/logout')
      .set('Cookie', refreshCookie);
    expect(logout.status).toBe(200);
    const revoked = await request(app)
      .post('/api/refresh')
      .set('Cookie', refreshCookie);
    expect(revoked.status).toBe(401);
  });

  it('lets athletes publish achievements for scouts and restricts management to the author', async () => {
    const registration = await request(app).post('/api/register').send({
      username: 'achiever_one',
      email: 'achiever@example.com',
      password: 'secure-password',
      role: 'talent',
    });
    const token = registration.body.data.accessToken as string;
    const headers = { Authorization: `Bearer ${token}` };

    const profileMissing = await request(app)
      .post('/api/posts')
      .set(headers)
      .send({ title: 'State meet finalist', description: 'Made the 100m final.' });
    expect(profileMissing.status).toBe(409);
    expect(profileMissing.body.error.code).toBe('PROFILE_REQUIRED');

    const profile = await request(app)
      .post('/api/athletes')
      .set(headers)
      .send({
        fullName: 'Asha Runner',
        age: 18,
        sport: 'Athletics',
        district: 'North District',
        region: 'North',
      });
    expect(profile.body.data.verificationStatus).toBe('pending');
    const missingPhoto = await request(app)
      .post('/api/posts')
      .set(headers)
      .field('title', 'State meet finalist')
      .field('description', 'Made the 100m final.');
    expect(missingPhoto.status).toBe(400);
    expect(missingPhoto.body.error.code).toBe('MEDIA_REQUIRED');

    const achievementPhoto = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    const created = await request(app)
      .post('/api/posts')
      .set(headers)
      .field('title', 'First place in the district final')
      .field('description', 'Won the 100m final after a personal-best run.')
      .field('eventDate', '2025-03-16')
      .attach('photo', achievementPhoto, { filename: 'achievement.png', contentType: 'image/png' });
    expect(created.status).toBe(201);
    expect(created.body.data.athlete.id).toBe(profile.body.data.id);
    expect(created.body.data.mediaType).toBe('image');
    expect(created.body.data.videoUrl).toBeNull();
    expect(created.body.data.eventDate).toBe('2025-03-16T00:00:00.000Z');
    expect(created.body.data.photoUrl).toMatch(new RegExp(`^/api/posts/${created.body.data.id as string}/photo\\?v=\\d+$`));

    const photo = await request(app).get(created.body.data.photoUrl as string);
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toContain('image/png');
    expect(photo.body).toEqual(achievementPhoto);

    const feed = await request(app).get('/api/posts');
    expect(feed.status).toBe(200);
    expect(feed.body.data.items[0].title).toBe('First place in the district final');
    expect(feed.body.data.items[0].athlete.fullName).toBe('Asha Runner');

    const video = Buffer.from('00000018667479706d703432', 'hex');
    const videoPost = await request(app)
      .post('/api/posts')
      .set(headers)
      .field('title', 'Sprint training video')
      .field('description', 'A video from training.')
      .attach('photo', video, { filename: 'training.mp4', contentType: 'video/mp4' });
    expect(videoPost.status).toBe(201);
    expect(videoPost.body.data.mediaType).toBe('video');
    expect(videoPost.body.data.photoUrl).toBeNull();
    expect(videoPost.body.data.videoUrl).toMatch(new RegExp(`^/api/posts/${videoPost.body.data.id as string}/video\\?v=\\d+$`));

    const downloadedVideo = await request(app).get(videoPost.body.data.videoUrl as string);
    expect(downloadedVideo.status).toBe(200);
    expect(downloadedVideo.headers['content-type']).toContain('video/mp4');
    expect(downloadedVideo.body).toEqual(video);
    const videoRange = await request(app).get(videoPost.body.data.videoUrl as string).set('Range', 'bytes=4-7');
    expect(videoRange.status).toBe(206);
    expect(videoRange.headers['content-range']).toBe(`bytes 4-7/${video.length}`);
    expect(videoRange.body).toEqual(Buffer.from('ftyp'));

    const webm = Buffer.from('1a45dfa3', 'hex');
    const webmPost = await request(app)
      .post('/api/posts')
      .set(headers)
      .field('title', 'WebM practice clip')
      .field('description', 'A WebM video from practice.')
      .attach('photo', webm, { filename: 'practice.webm', contentType: 'video/webm' });
    expect(webmPost.status).toBe(201);
    const downloadedWebm = await request(app).get(webmPost.body.data.videoUrl as string);
    expect(downloadedWebm.headers['content-type']).toContain('video/webm');
    expect(downloadedWebm.body).toEqual(webm);

    const mine = await request(app).get('/api/posts/mine').set(headers);
    expect(mine.body.data.items).toHaveLength(3);

    const otherRegistration = await request(app).post('/api/register').send({
      username: 'achiever_two',
      email: 'achiever-two@example.com',
      password: 'secure-password',
      role: 'talent',
    });
    const otherToken = otherRegistration.body.data.accessToken as string;
    await request(app)
      .post('/api/athletes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        fullName: 'Sam Runner',
        age: 19,
        sport: 'Athletics',
        district: 'South District',
        region: 'South',
      });
    const notAuthorUpdate = await request(app)
      .patch(`/api/posts/${created.body.data.id as string}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .field('title', 'Unauthorized edit')
      .field('description', 'This should not be saved.')
      .field('eventDate', '');
    expect(notAuthorUpdate.status).toBe(404);

    const updated = await request(app)
      .patch(`/api/posts/${created.body.data.id as string}`)
      .set(headers)
      .field('title', 'Updated district final result')
      .field('description', 'Updated achievement details.')
      .field('eventDate', '')
      .attach('photo', video, { filename: 'updated.mp4', contentType: 'video/mp4' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Updated district final result');
    expect(updated.body.data.eventDate).toBeNull();
    expect(updated.body.data.mediaType).toBe('video');
    expect(updated.body.data.photoUrl).toBeNull();
    const updatedVideo = await request(app).get(updated.body.data.videoUrl as string);
    expect(updatedVideo.body).toEqual(video);

    const notAuthor = await request(app)
      .delete(`/api/posts/${created.body.data.id as string}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(notAuthor.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/posts/${created.body.data.id as string}`)
      .set(headers);
    expect(removed.status).toBe(200);
  });

  it('registers talent, creates an athlete profile, and supports directory search', async () => {
    const registration = await request(app).post('/api/register').send({
      username: 'runner_one',
      email: 'runner@example.com',
      password: 'secure-password',
      role: 'talent',
    });
    expect(registration.status).toBe(201);
    expect(registration.body.success).toBe(true);
    expect(registration.body.data.accessToken).toBeTypeOf('string');
    expect(registration.body.data.user).not.toHaveProperty('passwordHash');

    const token = registration.body.data.accessToken as string;
    const profile = await request(app)
      .post('/api/athletes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Asha Runner',
        age: 18,
        sport: 'Athletics',
        district: 'North District',
        region: 'North',
        bio: 'Middle-distance runner',
      });
    expect(profile.status).toBe(201);
    expect(profile.body.data.verificationStatus).toBe('pending');

    const ownProfile = await request(app)
      .get('/api/athletes/me')
      .set('Authorization', `Bearer ${token}`);
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.data.fullName).toBe('Asha Runner');

    const analyticsUnavailable = await request(app)
      .get(`/api/athletes/${profile.body.data.id}/analytics`)
      .set('Authorization', `Bearer ${token}`);
    expect(analyticsUnavailable.status).toBe(403);

    const admin = await User.create({
      username: 'analytics_admin',
      email: 'analytics-admin@example.com',
      passwordHash: 'not-used-for-this-test',
      role: 'admin',
    });
    const adminToken = jwt.sign(
      { role: 'admin' },
      process.env.JWT_ACCESS_SECRET!,
      { subject: admin.id, expiresIn: '15m' },
    );
    const upgraded = await request(app)
      .put(`/api/admin/athletes/${profile.body.data.id}/tier`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tier: 'pro' });
    expect(upgraded.body.data.planTier).toBe('pro');

    await request(app).get(`/api/athletes/${profile.body.data.id}`);
    await request(app).get(`/api/athletes/${profile.body.data.id}`);
    const analytics = await request(app)
      .get(`/api/athletes/${profile.body.data.id}/analytics`)
      .set('Authorization', `Bearer ${token}`);
    expect(analytics.body.data.totalViews).toBe(2);

    const standardUser = await User.create({
      username: 'standard_runner',
      email: 'standard@example.com',
      passwordHash: 'not-used-for-this-test',
      role: 'talent',
    });
    await AthleteProfile.create({
      user: standardUser.id,
      fullName: 'Standard Runner',
      age: 19,
      sport: 'Athletics',
      district: 'North District',
      region: 'North',
    });
    const prioritized = await request(app).get('/api/athletes?district=North%20District');
    expect(prioritized.body.data.items[0].planTier).toBe('pro');
    expect(prioritized.body.data.items[0].fullName).toBe('Asha Runner');

    const directory = await request(app).get('/api/athletes?search=Ash&district=North%20District');
    expect(directory.status).toBe(200);
    expect(directory.body.data.items).toHaveLength(1);
    expect(directory.body.data.items[0].fullName).toBe('Asha Runner');

    const renamed = await request(app)
      .patch(`/api/athletes/${profile.body.data.id as string}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Asha Singh' });
    expect(renamed.status).toBe(200);
    const updatedOwnProfile = await request(app)
      .get('/api/athletes/me')
      .set('Authorization', `Bearer ${token}`);
    expect(updatedOwnProfile.body.data.fullName).toBe('Asha Singh');

    const login = await request(app).post('/api/login').send({
      email: 'runner@example.com',
      password: 'secure-password',
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe(registration.body.data.user.id);
  });

  it('accepts valid profile photos and rejects oversized uploads', async () => {
    const registration = await request(app).post('/api/register').send({
      username: 'photo_runner',
      email: 'photo@example.com',
      password: 'secure-password',
      role: 'talent',
    });
    const created = await request(app)
      .post('/api/athletes')
      .set('Authorization', `Bearer ${registration.body.data.accessToken}`)
      .send({
        fullName: 'Photo Runner',
        age: 21,
        sport: 'Cycling',
        district: 'South',
        region: 'South',
      });

    const id = created.body.data.id as string;
    const photo = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    const token = registration.body.data.accessToken as string;

    const uploaded = await request(app)
      .post(`/api/athletes/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', photo, { filename: 'profile.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(200);

    const downloaded = await request(app).get(`/api/athletes/${id}/photo`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['content-type']).toContain('image/png');
    expect(downloaded.body).toEqual(photo);

    const tooLarge = await request(app)
      .post(`/api/athletes/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.alloc(2 * 1024 * 1024 + 1, 0), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('allows an organization-domain scout to verify profiles and shortlist them', async () => {
    const host = await request(app).post('/api/register').send({
      username: 'scout_one',
      email: 'scout@sai.gov.in',
      password: 'secure-password',
      role: 'host',
    });
    const talent = await request(app).post('/api/register').send({
      username: 'runner_two',
      email: 'runner2@example.com',
      password: 'secure-password',
      role: 'talent',
    });
    const created = await request(app)
      .post('/api/athletes')
      .set('Authorization', `Bearer ${talent.body.data.accessToken}`)
      .send({
        fullName: 'Bina Runner',
        age: 20,
        sport: 'Running',
        district: 'East',
        region: 'East',
      });
    const profileId = created.body.data.id as string;
    const hostToken = host.body.data.accessToken as string;

    const pendingHostVerify = await request(app)
      .put(`/api/athletes/${profileId}/verification`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'verified' });
    expect(pendingHostVerify.status).toBe(200);

    const admin = await User.create({
      username: 'test_admin',
      email: 'admin@example.com',
      passwordHash: 'not-used-for-this-test',
      role: 'admin',
    });
    const adminToken = jwt.sign(
      { role: 'admin' },
      process.env.JWT_ACCESS_SECRET!,
      { subject: admin.id, expiresIn: '15m' },
    );
    const approvedHost = await request(app)
      .put(`/api/admin/hosts/${host.body.data.user.id}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });
    expect(approvedHost.body.data.verificationStatus).toBe('verified');
    expect((await User.findById(host.body.data.user.id))?.toObject()).toMatchObject({
      isVerified: true,
      verificationMethod: 'manual_approved',
    });

    const verified = await request(app)
      .put(`/api/athletes/${profileId}/verification`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'verified' });
    expect(verified.body.data.verificationStatus).toBe('verified');

    const shortlisted = await request(app)
      .post('/api/athletes/shortlist')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ athleteId: profileId });
    expect(shortlisted.body.data.shortlisted).toBe(true);

    const shortlist = await request(app)
      .get('/api/athletes/shortlist')
      .set('Authorization', `Bearer ${hostToken}`);
    expect(shortlist.body.data).toHaveLength(1);

    const connection = await request(app)
      .post(`/api/connections/${profileId}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ message: 'We would like to discuss a scouting opportunity.' });
    expect(connection.status).toBe(201);
    expect(connection.body.data.status).toBe('pending');

    const talentInbox = await request(app)
      .get('/api/connections')
      .set('Authorization', `Bearer ${talent.body.data.accessToken}`);
    expect(talentInbox.body.data).toHaveLength(1);
    expect(talentInbox.body.data[0].message).toContain('scouting opportunity');

    const response = await request(app)
      .patch(`/api/connections/${connection.body.data.id}`)
      .set('Authorization', `Bearer ${talent.body.data.accessToken}`)
      .send({ status: 'accepted' });
    expect(response.body.data.status).toBe('accepted');
  });

  it('lets pending scouts use scouting features without granting verification or admin access', async () => {
    const pendingScout = await request(app).post('/api/register').send({
      username: 'pending_scout', email: 'scout@example.com', password: 'secure-password', role: 'host',
    });
    expect(pendingScout.status).toBe(201);
    expect(pendingScout.body.data.user).toMatchObject({
      isVerified: false, verificationMethod: 'read_only_pending', hostVerificationStatus: 'pending',
    });
    expect((await request(app).get('/api/athletes').set('Authorization', `Bearer ${pendingScout.body.data.accessToken}`)).status).toBe(200);
    expect((await request(app).get('/api/athletes/shortlist').set('Authorization', `Bearer ${pendingScout.body.data.accessToken}`)).status).toBe(200);

    const player = await request(app).post('/api/register').send({
      username: 'instant_player', email: 'player@example.com', password: 'secure-password', role: 'talent',
    });
    expect(player.body.data.user).not.toHaveProperty('isVerified');
    expect(player.body.data.user).not.toHaveProperty('verificationMethod');

    const profile = await request(app)
      .post('/api/athletes')
      .set('Authorization', `Bearer ${player.body.data.accessToken}`)
      .send({ fullName: 'Scout Prospect', age: 20, sport: 'Running', district: 'North', region: 'North' });
    await AthleteProfile.findByIdAndUpdate(profile.body.data.id, { verificationStatus: 'verified' });

    const scoutToken = pendingScout.body.data.accessToken as string;
    const shortlisted = await request(app)
      .post('/api/athletes/shortlist')
      .set('Authorization', `Bearer ${scoutToken}`)
      .send({ athleteId: profile.body.data.id });
    expect(shortlisted.status).toBe(200);
    expect(shortlisted.body.data.shortlisted).toBe(true);
    const savedShortlist = await request(app)
      .get('/api/athletes/shortlist')
      .set('Authorization', `Bearer ${scoutToken}`);
    expect(savedShortlist.body.data.map((item: { id: string }) => item.id)).toContain(profile.body.data.id);

    const removed = await request(app)
      .delete(`/api/athletes/shortlist/${profile.body.data.id}`)
      .set('Authorization', `Bearer ${scoutToken}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.shortlisted).toBe(false);
    const updatedShortlist = await request(app)
      .get('/api/athletes/shortlist')
      .set('Authorization', `Bearer ${scoutToken}`);
    expect(updatedShortlist.body.data).toHaveLength(0);

    const connection = await request(app)
      .post(`/api/connections/${profile.body.data.id}`)
      .set('Authorization', `Bearer ${scoutToken}`)
      .send({ message: 'I would like to discuss a scouting opportunity.' });
    expect(connection.status).toBe(201);

    expect((await request(app)
      .put(`/api/athletes/${profile.body.data.id}/verification`)
      .set('Authorization', `Bearer ${scoutToken}`)
      .send({ status: 'verified' })).status).toBe(403);
    expect((await request(app)
      .get('/api/admin/hosts')
      .set('Authorization', `Bearer ${scoutToken}`)).status).toBe(403);

    const teacher = await request(app).post('/api/register').send({
      username: 'pending_teacher', email: 'teacher@example.com', password: 'secure-password', role: 'pe_teacher',
      institutionName: 'Local School', district: 'North',
    });
    expect(teacher.body.data.user).toMatchObject({ isVerified: false, verificationMethod: 'pending_review' });

    const verifiedTeacher = await request(app).post('/api/register').send({
      username: 'verified_teacher', email: 'teacher@school.edu.in', password: 'secure-password', role: 'pe_teacher',
      institutionName: 'District School', district: 'South',
    });
    expect(verifiedTeacher.body.data.user).toMatchObject({ isVerified: true, verificationMethod: 'domain_auto' });
  });

  it('lets verified PE teachers verify pending athlete profiles in their district', async () => {
    const teacher = await User.create({
      username: 'north_teacher',
      email: 'teacher@school.edu.in',
      role: 'pe_teacher',
      passwordHash: 'not-used-for-this-test',
      isVerified: true,
      verificationMethod: 'domain_auto',
      institutionName: 'North School',
      district: 'North',
    });
    const localAthlete = await User.create({
      username: 'local_athlete',
      email: 'local-athlete@example.com',
      role: 'talent',
      passwordHash: 'not-used-for-this-test',
    });
    const localProfile = await AthleteProfile.create({
      user: localAthlete.id,
      fullName: 'Local Prospect',
      age: 18,
      sport: 'Running',
      district: 'North',
      region: 'North',
    });
    const outsideAthlete = await User.create({
      username: 'outside_athlete',
      email: 'outside-athlete@example.com',
      role: 'talent',
      passwordHash: 'not-used-for-this-test',
    });
    const outsideProfile = await AthleteProfile.create({
      user: outsideAthlete.id,
      fullName: 'Outside Prospect',
      age: 19,
      sport: 'Cycling',
      district: 'South',
      region: 'South',
    });
    const localAchievement = await AchievementPost.create({
      athlete: localProfile.id,
      title: 'North district finalist',
      description: 'Finished first in the local final.',
      hasPhoto: true,
      hasVideo: false,
      photo: Buffer.from('89504e470d0a1a0a00000000', 'hex'),
      photoContentType: 'image/png',
    });

    const teacherToken = jwt.sign(
      { role: 'pe_teacher' },
      process.env.JWT_ACCESS_SECRET!,
      { subject: teacher.id, expiresIn: '15m' },
    );
    const localDirectory = await request(app)
      .get('/api/pe-teacher/athletes')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(localDirectory.status).toBe(200);
    expect(localDirectory.body.data.athletes.map((profile: { fullName: string }) => profile.fullName)).toContain('Local Prospect');
    expect(localDirectory.body.data.athletes.map((profile: { fullName: string }) => profile.fullName)).not.toContain('Outside Prospect');
    expect(localDirectory.body.data.athletes.find((profile: { fullName: string }) => profile.fullName === 'Local Prospect').id).toBe(localProfile.id);
    expect(localDirectory.body.data.posts[0]).toMatchObject({
      id: localAchievement.id,
      title: 'North district finalist',
      endorsementStatus: 'unverified',
      photoUrl: expect.stringContaining(`/api/posts/${localAchievement.id}/photo`),
      athlete: { id: localProfile.id, fullName: 'Local Prospect' },
    });

    const correctionRequested = await request(app)
      .patch(`/api/pe-teacher/endorse/${localAchievement.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'correction_requested', note: 'Please add the tournament date.' });
    expect(correctionRequested.status).toBe(200);
    const correctedFeed = await request(app)
      .get(`/api/posts?athleteId=${localProfile.id}`);
    expect(correctedFeed.body.data.items[0]).toMatchObject({
      endorsementStatus: 'correction_requested',
      endorsementNote: 'Please add the tournament date.',
    });

    const endorsed = await request(app)
      .patch(`/api/pe-teacher/endorse/${localAchievement.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'endorsed', note: 'Verified by the PE teacher.' });
    expect(endorsed.status).toBe(200);
    const endorsedFeed = await request(app)
      .get(`/api/posts?athleteId=${localProfile.id}`);
    expect(endorsedFeed.body.data.items[0]).toMatchObject({
      endorsementStatus: 'endorsed',
      endorsementNote: 'Verified by the PE teacher.',
    });

    const verified = await request(app)
      .put(`/api/pe-teacher/athletes/${localProfile.id}/verification`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(verified.status).toBe(200);
    expect(verified.body.data.verificationStatus).toBe('verified');
    expect((await AthleteProfile.findById(localProfile.id))?.verifiedBy?.toString()).toBe(teacher.id);

    const outsideDistrict = await request(app)
      .put(`/api/pe-teacher/athletes/${outsideProfile.id}/verification`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(outsideDistrict.status).toBe(403);

    const unverifiedTeacher = await User.create({
      username: 'pending_pe_teacher',
      email: 'pending-teacher@example.com',
      role: 'pe_teacher',
      passwordHash: 'not-used-for-this-test',
      isVerified: false,
      verificationMethod: 'pending_review',
      institutionName: 'North School',
      district: 'North',
    });
    const unverifiedTeacherToken = jwt.sign(
      { role: 'pe_teacher' },
      process.env.JWT_ACCESS_SECRET!,
      { subject: unverifiedTeacher.id, expiresIn: '15m' },
    );
    const denied = await request(app)
      .put(`/api/pe-teacher/athletes/${outsideProfile.id}/verification`)
      .set('Authorization', `Bearer ${unverifiedTeacherToken}`);
    expect(denied.status).toBe(403);
  });

  it('rejects duplicate registrations and unauthenticated profile creation', async () => {
    const payload = {
      username: 'runner_three',
      email: 'runner3@example.com',
      password: 'secure-password',
      role: 'talent',
    };
    expect((await request(app).post('/api/register').send(payload)).status).toBe(201);
    expect((await request(app).post('/api/register').send(payload)).status).toBe(409);
    expect((await request(app).post('/api/athletes').send({})).status).toBe(401);
  });
});
