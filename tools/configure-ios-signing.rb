require "xcodeproj"

project_path = Dir[File.join(Dir.pwd, "ios", "*.xcodeproj")].first
abort "No generated iOS Xcode project was found" unless project_path

team_id = ENV.fetch("APPLE_TEAM_ID")
target_profiles = {
  "Anne" => ENV.fetch("IOS_APP_PROFILE_UUID"),
  "ExpoWidgetsTarget" => ENV.fetch("IOS_WIDGET_PROFILE_UUID")
}

project = Xcodeproj::Project.open(project_path)
configured_targets = []

project.targets.each do |target|
  profile_uuid = target_profiles[target.name]
  next unless profile_uuid

  target.build_configurations.each do |configuration|
    settings = configuration.build_settings
    settings["CODE_SIGN_STYLE"] = "Manual"
    settings["DEVELOPMENT_TEAM"] = team_id
    settings["CODE_SIGN_IDENTITY"] = "Apple Distribution"
    settings["CODE_SIGN_IDENTITY[sdk=iphoneos*]"] = "Apple Distribution"
    settings["PROVISIONING_PROFILE"] = profile_uuid
    settings["PROVISIONING_PROFILE_SPECIFIER"] = profile_uuid
  end

  configured_targets << target.name
end

missing_targets = target_profiles.keys - configured_targets
abort "Signing targets not found: #{missing_targets.join(', ')}" unless missing_targets.empty?

project.save
puts "Configured manual App Store signing for: #{configured_targets.join(', ')}"
